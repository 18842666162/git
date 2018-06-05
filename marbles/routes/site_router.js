'use strict';
/* global process */
/*******************************************************************************
 * Copyright (c) 2018 JYKJ Corp.
 *
 * All rights reserved.
 *
 *******************************************************************************/
var express = require('express');
var bodyParser = require('body-parser');
var cachebust_js = Date.now();
var cachebust_css = Date.now();

module.exports = function (logger, cp) {
	var app = express();
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json())


	// ============================================================================================================================
	// Root
	// ============================================================================================================================
	app.get('/', function (req, res) {
		res.redirect('/home');
	});

	// ============================================================================================================================
	// Login
	// ============================================================================================================================
	app.get('/login', function (req, res) {
		res.render('login', { title: 'Marbles - Login', bag: build_bag(req) });
	});

	app.post('/login', function (req, res) {
		req.session.user = { username: req.body.username};
		let username = req.body.username;
		if (req.body.position == 0) {
			req.body.position = 0; //管理员
			res.redirect('/home');
		}if (req.body.position == 1){
			req.body.position = 1; //审批员
			res.render('approval', { title: 'Marbles - Approval', bag: build_bag(req) });
		} else {
			req.body.position = 2; //普通用户
			res.render('user', { title: 'Marbles - User', bag: build_bag(req) });
		}
 
	});

	app.get('/logout', function (req, res) {
		req.session.destroy();
		res.redirect('/login');
	});


	// ============================================================================================================================
	// Home
	// ============================================================================================================================
	app.get('/home', function (req, res) {
		route_me(req, res);
	});

	app.get('/create', function (req, res) {
		route_me(req, res);
	});

	function route_me(req, res) {
		//if (!req.session.user || !req.session.user.username) {		// no session? send them to login
		//	res.redirect('/login');
		//} else {
		res.render('marbles', { title: 'Marbles - Home', bag: build_bag(req) });
		//}
	}


	//这里的任何东西都传递给PUG模板引擎
	function build_bag(req) {
		return {
			e: process.error,							//发送任何设置错误
			config_filename: cp.config_filename,
			cp_filename: cp.config.cred_filename,
			jshash: cachebust_js,						//js cache busting hash (not important)
			csshash: cachebust_css,						//css cache busting hash (not important)
			marble_company: process.env.marble_company,
			creds: get_credential_data(),
			using_env: cp.using_env,
			myname:req.body.username,
			position:req.body.position
		};
	}

	//get cred data  获取信用数据
	function get_credential_data() {
		const channel = cp.getChannelId();
		const first_org = cp.getClientOrg();
		const first_ca = cp.getFirstCaName(first_org);
		const first_peer = cp.getFirstPeerName(channel);
		const first_orderer = cp.getFirstOrdererName(channel);
		var ret = {
			admin_id: cp.getEnrollObj(first_ca, 0).enrollId,
			admin_secret: cp.getEnrollObj(first_ca, 0).enrollSecret,
			orderer: cp.getOrderersUrl(first_orderer),
			ca: cp.getCasUrl(first_ca),
			peer: cp.getPeersUrl(first_peer),
			chaincode_id: cp.getChaincodeId(),
			channel: cp.getChannelId(),
			chaincode_version: cp.getChaincodeVersion(),
			marble_owners: cp.getMarbleUsernames(),
		};
		for (var i in ret) {
			if (ret[i] == null) ret[i] = '';			//set to blank if not found
		}
		return ret;
	}

	return app;
};
