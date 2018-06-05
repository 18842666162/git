// ==================================
// 服务器端代码
// ==================================

module.exports = function (cp, fcw, logger) {
	var ws_server = {};
	var known_everything = {};
	var marbles_lib = {};
	var wss = {};
	var known_height = 0;
	var checkPeriodically = null;
	var enrollInterval = null;
	var start_up_states = {												//Marbles Startup Steps
		checklist: { state: 'waiting', step: 'step1' },					// Step 1 - check config files for somewhat correctness
		enrolling: { state: 'waiting', step: 'step2' },					// Step 2 - enroll the admin
		find_chaincode: { state: 'waiting', step: 'step3' },			// Step 3 - find the chaincode on the channel
		register_owners: { state: 'waiting', step: 'step4' },			// Step 4 - create the marble owners
	};

	//--------------------------------------------------------
	// 设置WS模块
	//--------------------------------------------------------
	ws_server.setup = function (l_wss, l_marbles_lib) {
		marbles_lib = (l_marbles_lib) ? l_marbles_lib : marbles_lib;
		wss = (l_wss) ? l_wss : wss;

		// --- Keep Alive  --- //
		clearInterval(enrollInterval);
		enrollInterval = setInterval(function () {						//为了避免请求超时错误，我们定期重新注册。to avoid REQUEST_TIMEOUT errors we periodically re-enroll
			let enroll_options = cp.makeEnrollmentOptions(0);
			fcw.enroll(enroll_options, function (err, enrollObj2) { });	//this seems to be safe 3/27/2017
		}, cp.getKeepAliveMs());										//超时发生在5分钟，所以这个间隔应该比那个快。timeout happens at 5 minutes, so this interval should be faster than that
	};

	// Message to client to communicate where we are in the start up
	//向客户端发送消息，以便我们在启动时进行通信
	ws_server.build_state_msg = function () {
		return {
			msg: 'app_state',
			state: start_up_states,
		};
	};

	// record new app state
	//记录新的应用程序状态
	ws_server.record_state = function (change_state, outcome) {
		start_up_states[change_state].state = outcome;
	};

	// Send to all connected clients
	//发送给所有连接的客户端
	logger.info('——————————————Tenney——————————————— 发送给所有连接的客户端 ——————————————Tenney———————————————');
	ws_server.broadcast_state = function () {
		try {
			wss.broadcast(ws_server.build_state_msg());						//tell client our app state
		} catch (e) { }														//this is expected to fail for "checking"
	};

	//--------------------------------------------------------
	// Process web socket messages - blockchain code is near. "marbles_lib"   处理Web套接字消息
	//--------------------------------------------------------
	ws_server.process_msg = function (ws, data) {
		const channel = cp.getChannelId();
		const first_peer = cp.getFirstPeerName(channel);
		var options = {
			peer_urls: [cp.getPeersUrl(first_peer)],
			ws: ws,
			endorsed_hook: endorse_hook,
			ordered_hook: orderer_hook
		};
		if (marbles_lib === null) {
			logger.error('marbles lib is null...');				//can't run in this state
			return;
		}

		// create a new marble  创造一个新的大理石
		if (data.type === 'create') {
			logger.info('——————————————Tenney——————————————— 创造一个新的大理石 ——————————————Tenney———————————————');
			logger.info('[ws] create marbles req');
			options.args = {
				color: data.color,
				size: data.size,
				marble_owner: data.username,
				owners_company: data.company,
				owner_id: data.owner_id,
				auth_company: process.env.marble_company,
				value:'50',
				password:'123456'
			};

			marbles_lib.create_a_marble(options, function (err, resp) {
				if (err != null) send_err(err, data);
				else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
			});
		}

		// transfer a marble 转移大理石
		else if (data.type === 'transfer_marble') {
			logger.info('——————————————Tenney——————————————— 转移 ——————————————Tenney———————————————');
			logger.info('[ws] transferring req');
			options.args = {
				marble_id: data.id,
				owner_id: data.owner_id,
				auth_company: process.env.marble_company
			};

			marbles_lib.set_marble_owner(options, function (err, resp) {
				if (err != null) send_err(err, data);
				else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
			});
		}

		// delete marble
		else if (data.type === 'delete_marble') {
			logger.info('[ws] delete marble req');
			options.args = {
				marble_id: data.id,
				auth_company: process.env.marble_company
			};

			marbles_lib.delete_marble(options, function (err, resp) {
				if (err != null) send_err(err, data);
				else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
			});
		}

		// get all owners, marbles, & companies  获得所有的所有者、大理石和公司
		else if (data.type === 'read_everything') {
			logger.info('[ws] read everything req');
			ws_server.check_for_updates(ws);
		}

		// get history of marble  获得大理石历史
		else if (data.type === 'audit') {
			if (data.marble_id) {
				logger.info('[ws] audit history');
				options.args = {
					id: data.marble_id,
				};
				marbles_lib.get_history(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'history', data: resp }));
				});
			}
		}
		//注册
		else if (data.type === 'register') {
			logger.info('———————Tenney———————注册————————Tenney————————');
			if (data.user_name) {
				logger.info('[ws] audit history 注册');
				options.args = {
					username:data.user_name,
					password:data.user_pass,
					company:data.user_company
				};
				marbles_lib.put_user(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'register', data: resp }));
				});
			}
		}
		//权限分配
		else if (data.type === 'identity') {
			logger.info('———————Tenney———————权限分配————————Tenney————————');
			if (data.wner_id) {
				logger.info('[ws] audit history 权限分配');
				options.args = {
					owner_id:data.wner_id,
					compan:data.compan
				};
				marbles_lib.identity(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'identity', data: resp }));
				});
			}
		}
		//登陆
		else if (data.type === 'login') {
			logger.info('———————Tenney———————登陆————————Tenney————————');
			if (data.user_id) {
				logger.info('[ws] audit history 登陆');
				options.args = {
					owner_id:data.user_id
				};
				marbles_lib.login(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'login', data: resp }));
				});
			}
		}
		//审批
		else if (data.type === 'approval') {
			logger.info('———————Tenney———————审批————————Tenney————————');
			if (data.marble_id) {
				logger.info('[ws] audit history 审批');
				options.args = {
					marble_id:data.marble_id,
					status:data.status
				};
				marbles_lib.approval(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'approval', data: resp }));
				});
			}
		}
		//物品上架
		else if (data.type === 'on_shelf') {
			logger.info('———————Tenney———————物品上架————————Tenney————————');
			if (data.marble_id) {
				logger.info('[ws] audit history 物品上架');
				options.args = {
					marble_id:data.marble_id,
					want_color:data.want_color
				};
				marbles_lib.on_shelf(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'on_shelf', data: resp }));
				});
			}
		}
		//exchange  物品交换
		else if (data.type === 'exchange') {
			logger.info('———————Tenney———————物品交换————————Tenney————————');
			if (data.auction_id) {
				logger.info('[ws] audit history 物品交换');
				options.args = {
					auction_id:data.auction_id,
					ex_marble_id:data.ex_marble_id
				};
				marbles_lib.exchange(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'exchange', data: resp }));
				});
			}
		}
		// disable marble owner  禁用大理石所有者
		else if (data.type === 'disable_owner') {
			if (data.owner_id) {
				logger.info('[ws] disable owner');
				options.args = {
					owner_id: data.owner_id,
					auth_company: process.env.marble_company
				};
				marbles_lib.disable_owner(options, function (err, resp) {
					if (err != null) send_err(err, resp);
					else options.ws.send(JSON.stringify({ msg: 'tx_step', state: 'finished' }));
				});
			}
		}

		// send transaction error msg   发送事务错误MSG
		function send_err(msg, input) {
			sendMsg({ msg: 'tx_error', e: msg, input: input });
			sendMsg({ msg: 'tx_step', state: 'committing_failed' });
		}

		// send a message, socket might be closed...   发送消息，套接字可能会关闭…
		function sendMsg(json) {
			if (ws) {
				try {
					ws.send(JSON.stringify(json));
				}
				catch (e) {
					logger.debug('[ws error] could not send msg', e);
				}
			}
		}

		// endorsement stage callback    认可阶段回调
		function endorse_hook(err) {
			if (err) sendMsg({ msg: 'tx_step', state: 'endorsing_failed' });
			else sendMsg({ msg: 'tx_step', state: 'ordering' });
		}

		// ordering stage callback   排序阶段回调
		function orderer_hook(err) {
			if (err) sendMsg({ msg: 'tx_step', state: 'ordering_failed' });
			else sendMsg({ msg: 'tx_step', state: 'committing' });
		}
	};

	// sch next periodic check   下一步，定期检查
	function sch_next_check() {
		clearTimeout(checkPeriodically);
		checkPeriodically = setTimeout(function () {
			try {
				ws_server.check_for_updates(null);
			}
			catch (e) {
				console.log('');
				logger.error('Error in sch next check\n\n', e);
				sch_next_check();
				ws_server.check_for_updates(null);
			}
		}, cp.getBlockDelay() + 2000);
	}

	// --------------------------------------------------------
	// Check for Updates to Ledger   检查Ledger的更新
	// --------------------------------------------------------
	ws_server.check_for_updates = function (ws_client) {
		marbles_lib.channel_stats(null, function (err, resp) {
			var newBlock = false;
			if (err != null) {
				var eObj = {
					msg: 'error',
					e: err,
				};
				if (ws_client) ws_client.send(JSON.stringify(eObj)); 									//send to a client
				else wss.broadcast(eObj);																//send to all clients
			} else {
				if (resp && resp.height && resp.height.low) {
					if (resp.height.low > known_height || ws_client) {
						if (!ws_client) {
							console.log('');
							logger.info('New block detected!', resp.height.low, resp);
							known_height = resp.height.low;
							newBlock = true;
							logger.debug('[checking] there are new things, sending to all clients');
							wss.broadcast({ msg: 'block', e: null, block_height: resp.height.low });	//send to all clients
						} else {
							logger.debug('[checking] on demand req, sending to a client');
							var obj = {
								msg: 'block',
								e: null,
								block_height: resp.height.low,
								block_delay: cp.getBlockDelay()
							};
							ws_client.send(JSON.stringify(obj)); 										//发送给客户
						}
					}
				}
			}

			if (newBlock || ws_client) {
				read_everything(ws_client, function () {
					sch_next_check();						//check again
				});
			} else {
				sch_next_check();							//check again
			}
		});
	};

	// read complete state of marble world    阅读大理石世界的完整状态
	function read_everything(ws_client, cb) {
		const channel = cp.getChannelId();
		const first_peer = cp.getFirstPeerName(channel);
		var options = {
			peer_urls: [cp.getPeersUrl(first_peer)],
		};

		marbles_lib.read_everything(options, function (err, resp) {
			if (err != null) {
				console.log('');
				logger.debug('[checking] could not get everything:', err);
				var obj = {
					msg: 'error',
					e: err,
				};
				if (ws_client) ws_client.send(JSON.stringify(obj)); 								//send to a client
				else wss.broadcast(obj);																//send to all clients
				if (cb) cb();
			}
			else {
				var data = resp.parsed;
				if (data && data.owners && data.marbles) {
					console.log('');
					logger.debug('[checking] number of owners:', data.owners.length);
					logger.debug('[checking] number of marbles:', data.marbles.length);
				}

				data.owners = organize_usernames(data.owners);
				data.marbles = organize_marbles(data.marbles);
				var knownAsString = JSON.stringify(known_everything);			//stringify for easy comparison (order should stay the same)
				var latestListAsString = JSON.stringify(data);

				if (knownAsString === latestListAsString) {
					logger.debug('[checking] same everything as last time');
					if (ws_client !== null) {									//if this is answering a clients req, send to 1 client
						logger.debug('[checking] sending to 1 client');
						ws_client.send(JSON.stringify({ msg: 'everything', e: err, everything: data }));
					}
				}
				else {															//detected new things, send it out
					logger.debug('[checking] there are new things, sending to all clients');
					known_everything = data;
					wss.broadcast({ msg: 'everything', e: err, everything: data });	//sent to all clients
				}
				if (cb) cb();
			}
		});
	}

	// organize the marble owner list  组织大理石所有者名单
	function organize_usernames(data) {
		var ownerList = [];
		var myUsers = [];
		for (var i in data) {						//让我们重新格式化它，只需要1个对等体的响应 lets reformat it a bit, only need 1 peer's response
			var temp = {
				id: data[i].id,
				username: data[i].username,
				company: data[i].company
			};
			if (temp.company === process.env.marble_company) {
				myUsers.push(temp);					//这些是我的公司用户  these are my companies users
			}
			else {
				ownerList.push(temp);				//其他人  everyone else
			}
		}

		ownerList = sort_usernames(ownerList);
		ownerList = myUsers.concat(ownerList);		//我的用户是第一个，把其他的带来 my users are first, bring in the others
		return ownerList;
	}

	//
	function organize_marbles(allMarbles) {
		var ret = {};
		for (var i in allMarbles) {
			if (!ret[allMarbles[i].owner.username]) {
				ret[allMarbles[i].owner.username] = {
					owner_id: allMarbles[i].owner.id,
					username: allMarbles[i].owner.username,
					company: allMarbles[i].owner.company,
					marbles: []
				};
			}
			ret[allMarbles[i].owner.username].marbles.push(allMarbles[i]);
		}
		return ret;
	}

	// alpha sort everyone else
	function sort_usernames(temp) {
		temp.sort(function (a, b) {
			var entryA = a.company + a.username;
			var entryB = b.company + b.username;
			if (entryA < entryB) return -1;
			if (entryA > entryB) return 1;
			return 0;
		});
		return temp;
	}

	return ws_server;
};
