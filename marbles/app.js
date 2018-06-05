'use strict';
/* global process */
/* global __dirname */
/*******************************************************************************
 * [Marbles] - a simple Hyperledger Fabric blockchain application
 *
 * How To Run: Read readme on how to run. Typically it is something like `gulp marbles_tls` or `gulp marbles_local`
 *
 * How to Use: Read readme, please.
 *
 * Copyright (c) 2015 IBM Corp.
 * All rights reserved.
 *
 *******************************************************************************/
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var compression = require('compression');
var serve_static = require('serve-static');
var path = require('path');
var cookieParser = require('cookie-parser');
var http = require('http');
var app = express();
var cors = require('cors');
var ws = require('ws');											// websocket module
var winston = require('winston');								// logger module

// ------------- Init our libraries ------------- //
var wss = {};
var marbles_lib = null;
var logger = new (winston.Logger)({
	level: 'debug',
	transports: [
		new (winston.transports.Console)({ colorize: true }),
	]
});
var misc = require('./utils/misc.js')(logger);												// mis.js has generic (non-blockchain) related functions
misc.check_creds_for_valid_json();
var cp = require(__dirname + '/utils/connection_profile_lib/index.js')(process.env.creds_filename, logger);	// parses our cp file/data
var host = 'localhost';
var port = cp.getMarblesPort();
process.env.marble_company = cp.getClientsOrgName();

// fabric client wrangler wraps the SDK  结构客户端处理程序包装SDK
var fcw = require('./utils/fc_wrangler/index.js')({ block_delay: cp.getBlockDelay() }, logger);

// websocket logic
var ws_server = require('./utils/websocket_server_side.js')(cp, fcw, logger);

// setup/startup logic
var startup_lib = require('./utils/startup_lib.js')(logger, cp, fcw, marbles_lib, ws_server);

// ------------- IBM Cloud Host Detection ------------- //
if (process.env.VCAP_APPLICATION) {
	host = '0.0.0.0';												//overwrite defaults
	port = process.env.PORT;
}

// --- Setup Express --- //
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(compression());
app.use(cookieParser());
app.use(serve_static(path.join(__dirname, 'public')));
app.use(session({ secret: 'lostmymarbles', resave: true, saveUninitialized: true }));
app.options('*', cors());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())

// ============================================================================================================================
// 												HTTP Webserver Routing
// ============================================================================================================================
app.use(function (req, res, next) {
	logger.debug('------------------------------------------ incoming request ------------------------------------------');
	logger.debug('New ' + req.method + ' request for', req.url);
	req.bag = {};																	// create object for client exposed session data
	req.bag.session = req.session;
	next();
});
app.use('/', require('./routes/site_router.js')(logger, cp));						// 大多数路线都在这里 most routes are in here

// ------ Error Handling --------
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});
app.use(function (err, req, res, next) {
	logger.debug('Errors -', req.url);
	var errorCode = err.status || 500;
	res.status(errorCode);
	req.bag.error = { msg: err.stack, status: errorCode };
	if (req.bag.error.status == 404) req.bag.error.msg = 'Sorry, I cannot locate that file';
	res.render('template/error', { bag: req.bag });
});


// ============================================================================================================================
// 														Launch HTTP Webserver
// ============================================================================================================================
var server = http.createServer(app).listen(port, function () { });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
server.timeout = 240000;
console.log('\n');
console.log('----------------------------------- Server Up - ' + host + ':' + port + ' -----------------------------------');
process.on('uncaughtException', function (err) {
	logger.error('Caught exception: ', err.stack);		// marbles never gives up! (this is bad practice, but its just a demo)
	if (err.stack.indexOf('EADDRINUSE') >= 0) {			// well, except for this error
		logger.warn('---------------------------------------------------------------');
		logger.warn('----------------------------- Ah! -----------------------------');
		logger.warn('---------------------------------------------------------------');
		logger.error('You already have something running on port ' + port + '!');
		logger.error('Kill whatever is running on that port OR change the port setting in your marbles config file: ' + cp.config_path);
		process.exit();
	}
	if (wss && wss.broadcast) {							// if possible send the error out to the client 如果可能的话，将错误发送给客户端
		wss.broadcast({
			msg: 'error',
			info: 'this is a backend error!',
			e: err.stack,
		});
	}
});
// ============================================================================================================================
// 														Warning
// ============================================================================================================================

// ============================================================================================================================
// 														Entering
// ============================================================================================================================

// ============================================================================================================================
// 														Work Area
// ============================================================================================================================

// ------------------------------------------------------------------------------------------------------------------------------
// The real show starts here!
// - 上面的所有内容都是静态设置，它并不有趣
// - 下面的步骤将在应用程序启动时运行，它们很有趣
// - 这些步骤将测试与区块链网络上的弹珠链代码进行通信的能力
// ------------------------------------------------------------------------------------------------------------------------------
let config_error = cp.checkConfig();
setupWebSocket();											// http服务器已经启动，现在就做一个ws //http server is already up, make the ws one now

if (config_error) {
	ws_server.record_state('checklist', 'failed');			// checklist step is done
	ws_server.broadcast_state();
} else {
	ws_server.record_state('checklist', 'success');		// checklist step is done
	console.log('\n');

	// --- [1] 测试注册我们的CA --- //
	startup_lib.enroll_admin(1, function (e) {
		if (e != null) {
			logger.warn('Error enrolling admin');
			ws_server.record_state('enrolling', 'failed');
			ws_server.broadcast_state();
			startup_lib.startup_unsuccessful(host, port);
		} else {
			logger.info('Success enrolling admin');
			ws_server.record_state('enrolling', 'success');
			ws_server.broadcast_state();

			// --- [2] Setup Marbles Library  设置大理石库--- //
			startup_lib.setup_marbles_lib(host, port, function () {

				// --- [3] Check If We have Started Marbles Before 检查如果我们之前已经开始项目 --- //
				startup_lib.detect_prev_startup({ startup: true }, function (err) {
					if (err) {
						startup_lib.startup_unsuccessful(host, port);
					} else {
						console.log('\n\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -');
						logger.debug('Detected that we have launched successfully before');
						logger.debug('Welcome back - Marbles is ready');
						logger.debug('Open your browser to http://' + host + ':' + port + ' and login as "admin"');
						console.log('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n\n');
					}
				});

				// --- [4] Wait for the user to go to the browser (step 5 is in websocket code below) --- //
				// ZZzzzzzZZZzzzzzzzzZZzZZZZZzzzZZZzzz
			});
		}
	});
}

// ============================================================================================================================
// 												Launch WebSocket Server 启动WebSocket服务器
// ============================================================================================================================
function setupWebSocket() {
	console.log('------------------------------------------ Websocket Up ------------------------------------------');
	wss = new ws.Server({ server: server });						//现在启动  start the websocket now
	wss.on('connection', function connection(ws) {

		// -- Process all websocket messages 处理所有websocket消息 -- //
		ws.on('message', function incoming(message) {
			console.log(' ');
			console.log('-------------------------------- Incoming WS Msg --------------------------------');
			logger.debug('[ws] received ws msg:', message);
			var data = null;
			try {
				data = JSON.parse(message);							// it better be json
			} catch (e) {
				logger.debug('[ws] message error', message, e.stack);
			}

			// --- [5] 处理WS消息   --- //
			if (data && data.type == 'setup') {						// its a setup request, enter the setup code
				logger.debug('[ws] setup message', data);
				startup_lib.setup_ws_steps(data);					// <-- 打开startup_lib.js查看启动代码的其余部分 open startup_lib.js to view the rest of the start up code

			} else if (data) {										// 它是一个普通的大理石请求，把它传递给库中进行处理。 its a normal marble request, pass it to the lib for processing
				ws_server.process_msg(ws, data);					// <-- the interesting "blockchainy" code is this way (websocket_server_side.js)
			}
		});

		// log web socket errors
		ws.on('error', function (e) { logger.debug('[ws] error', e); });

		// log web socket connection disconnects (typically client closed browser)
		ws.on('close', function () { logger.debug('[ws] closed'); });

		// whenever someone connects, tell them our app's state
		ws.send(JSON.stringify(ws_server.build_state_msg()));				// tell client our app state  告诉客户我们的应用状态
	});

	// --- Send a message to all connected clients  向所有连接的客户端发送消息--- //
	wss.broadcast = function broadcast(data) {
		var i = 0;
		wss.clients.forEach(function each(client) {							// iter on each connection
			try {
				logger.debug('[ws] broadcasting to clients. ', (++i), data.msg);
				client.send(JSON.stringify(data));							// BAM, send the data  BAM，发送数据
			} catch (e) {
				logger.debug('[ws] error broadcast ws', e);
			}
		});
	};

	ws_server.setup(wss, null);
}
