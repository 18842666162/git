/* global $, window, document */
/* global toTitleCase, connect_to_server, refreshHomePanel, closeNoticePanel, openNoticePanel, show_tx_step, marbles*/
/* global pendingTxDrawing:true */
/* exported record_company, autoCloseNoticePanel, start_up, block_ui_delay*/
var ws = {};
var bgcolors = ['whitebg', 'blackbg', 'redbg', 'greenbg', 'bluebg', 'purplebg', 'pinkbg', 'orangebg', 'yellowbg'];
var autoCloseNoticePanel = null;
var known_companies = {};
var start_up = true;
var lsKey = 'marbles';
var fromLS = {};
var block_ui_delay = 15000; 								//default, gets set in ws block msg
var auditingMarble = null;

// =================================================================================
// On Load
// =================================================================================
$(document).on('ready', function () {
	console.log("_____Tenney____________________ ui_events ____________________Tenney_____");
	fromLS = window.localStorage.getItem(lsKey);
	if (fromLS) fromLS = JSON.parse(fromLS);
	else fromLS = { story_mode: false };					//dsh todo remove this
	console.log('from local storage', fromLS);

	connect_to_server();

	// =================================================================================
	// jQuery UI Events
	// =================================================================================
	$('#createMarbleButton').click(function () {
		console.log('creating marble');
		var obj = {
			type: 'create',
			color: $('.colorSelected').attr('color'),
			size: $('select[name="size"]').val(),
			username: $('select[name="user"]').val(),
			company: $('input[name="company"]').val(),
			owner_id: $('input[name="owner_id"]').val(),
			v: 1
		};
		console.log('creating marble, sending', obj);
		$('#createPanel').fadeOut();
		$('#tint').fadeOut();

		show_tx_step({ state: 'building_proposal' }, function () {
			ws.send(JSON.stringify(obj));

			refreshHomePanel();
			$('.colorValue').html('Color');											//reset
			for (var i in bgcolors) $('.createball').removeClass(bgcolors[i]);		//reset
			$('.createball').css('border', '2px dashed #fff');						//reset
		});

		return false;
	});

	//fix marble owner panel (don't filter/hide it) 修复大理石所有者面板（不要过滤/隐藏它）
	$(document).on('click', '.marblesFix', function () {
		if ($(this).parent().parent().hasClass('marblesFixed')) {
			$(this).parent().parent().removeClass('marblesFixed');
		}
		else {
			$(this).parent().parent().addClass('marblesFixed');
		}
	});

	//marble color picker  大理石颜色选择器
	$(document).on('click', '.colorInput', function () {
		$('.colorOptionsWrap').hide();											//hide any others
		$(this).parent().find('.colorOptionsWrap').show();
	});
	$(document).on('click', '.colorOption', function () {
		var color = $(this).attr('color');
		var html = '<span class="fa fa-circle colorSelected ' + color + '" color="' + color + '"></span>';

		$(this).parent().parent().find('.colorValue').html(html);
		$(this).parent().hide();

		for (var i in bgcolors) $('.createball').removeClass(bgcolors[i]);		//remove prev color
		$('.createball').css('border', '0').addClass(color + 'bg');				//set new color
	});

	//username/company search
	$('#searchUsers').keyup(function () {
		var count = 0;
		var input = $(this).val().toLowerCase();
		for (var i in known_companies) {
			known_companies[i].visible = 0;
		}

		//reset - clear search
		if (input === '') {
			$('.marblesWrap').show();
			count = $('#totalUsers').html();
			$('.companyPanel').fadeIn();
			for (i in known_companies) {
				known_companies[i].visible = known_companies[i].count;
				$('.companyPanel[company="' + i + '"]').find('.companyVisible').html(known_companies[i].visible);
				$('.companyPanel[company="' + i + '"]').find('.companyCount').html(known_companies[i].count);
			}
		}
		else {
			var parts = input.split(',');
			console.log('searching on', parts);

			//figure out if the user matches the search 弄清楚用户是否与搜索相匹配
			$('.marblesWrap').each(function () {												//iter on each marble user wrap
				var username = $(this).attr('username');
				var company = $(this).attr('company');
				if (username && company) {
					var full = (username + company).toLowerCase();
					var show = false;

					for (var x in parts) {													//iter on each search term
						if (parts[x].trim() === '') continue;
						if (full.indexOf(parts[x].trim()) >= 0 || $(this).hasClass('marblesFixed')) {
							count++;
							show = true;
							known_companies[company].visible++;								//this user is visible
							break;
						}
					}

					if (show) $(this).show();
					else $(this).hide();
				}
			});

			//show/hide the company panels 显示/隐藏公司面板
			for (i in known_companies) {
				$('.companyPanel[company="' + i + '"]').find('.companyVisible').html(known_companies[i].visible);
				if (known_companies[i].visible === 0) {
					console.log('hiding company', i);
					$('.companyPanel[company="' + i + '"]').fadeOut();
				}
				else {
					$('.companyPanel[company="' + i + '"]').fadeIn();
				}
			}
		}
		//user count
		$('#foundUsers').html(count);
	});

	//login events 登录事件
	$('#whoAmI').click(function () {													//drop down for login 下拉登录
		if ($('#userSelect').is(':visible')) {
			$('#userSelect').fadeOut();
			$('#carrot').removeClass('fa-angle-up').addClass('fa-angle-down');
		}
		else {
			$('#userSelect').fadeIn();
			$('#carrot').removeClass('fa-angle-down').addClass('fa-angle-up');
		}
	});

	//open create marble panel 打开创建大理石面板
	$(document).on('click', '.addMarble', function () {
		$('#tint').fadeIn();
		$('#createPanel').fadeIn();
		var company = $(this).parents('.innerMarbleWrap').parents('.marblesWrap').attr('company');
		var username = $(this).parents('.innerMarbleWrap').parents('.marblesWrap').attr('username');
		var owner_id = $(this).parents('.innerMarbleWrap').parents('.marblesWrap').attr('owner_id');
		$('select[name="user"]').html('<option value="' + username + '">' + toTitleCase(username) + '</option>');
		$('input[name="company"]').val(company);
		$('input[name="owner_id"]').val(owner_id);
	});

	//close create marble panel 关闭创建大理石面板
	$('#tint').click(function () {
		if ($('#startUpPanel').is(':visible')) return;
		if ($('#txStoryPanel').is(':visible')) return;
		$('#createPanel, #tint, #settingsPanel').fadeOut();
	});

	//notification drawer 通知抽屉
	$('#notificationHandle').click(function () {
		if ($('#noticeScrollWrap').is(':visible')) {
			closeNoticePanel();
		}
		else {
			openNoticePanel();
		}
	});

	//hide a notification  隐藏通知
	$(document).on('click', '.closeNotification', function () {
		$(this).parents('.notificationWrap').fadeOut();
	});

	//settings panel 设置面板
	$('#showSettingsPanel').click(function () {
		$('#settingsPanel, #tint').fadeIn();
	});
	$('#closeSettings').click(function () {
		$('#settingsPanel, #tint').fadeOut();
	});

	//story mode selection 故事模式选择
	$('#disableStoryMode').click(function () {
		set_story_mode('off');
	});
	$('#enableStoryMode').click(function () {
		set_story_mode('on');
	});

	//close create panel 关闭创建面板
	$('#closeCreate').click(function () {
		$('#createPanel, #tint').fadeOut();
	});

	//change size of marble 改变大理石的大小
	$('select[name="size"]').click(function () {
		var size = $(this).val();
		if (size === '16') $('.createball').animate({ 'height': 150, 'width': 150 }, { duration: 200 });
		else $('.createball').animate({ 'height': 250, 'width': 250 }, { duration: 200 });
	});

	//right click opens audit on marble 右击打开大理石上的审核
	$(document).on('contextmenu', '.ball', function () {
		auditMarble(this, true);
		return false;
	});

	//left click audits marble  左键点击审核大理石
	$(document).on('click', '.ball', function () {
		auditMarble(this, false);
	});

	function auditMarble(that, open) {
		var marble_id = $(that).attr('id');
		$('.auditingMarble').removeClass('auditingMarble');

		if (!auditingMarble || marbles[marble_id].id != auditingMarble.id) {//different marble than before!
			for (var x in pendingTxDrawing) clearTimeout(pendingTxDrawing[x]);
			$('.txHistoryWrap').html('');										//clear
		}

		auditingMarble = marbles[marble_id];
		console.log('\n user clicked on marble', marble_id);

		if (open || $('#auditContentWrap').is(':visible')) {
			$(that).addClass('auditingMarble');
			$('#auditContentWrap').fadeIn();
			$('#marbleId').html(marble_id);
			var color = marbles[marble_id].color;
			for (var i in bgcolors) $('.auditMarble').removeClass(bgcolors[i]);	//reset
			$('.auditMarble').addClass(color.toLowerCase() + 'bg');

			$('#rightEverything').addClass('rightEverythingOpened');
			$('#leftEverything').fadeIn();

			var obj2 = {
				type: 'audit',
				marble_id: marble_id
			};
			ws.send(JSON.stringify(obj2));
		}
	}

	$('#auditClose').click(function () {
		$('#auditContentWrap').slideUp(500);
		$('.auditingMarble').removeClass('auditingMarble');												//reset
		for (var x in pendingTxDrawing) clearTimeout(pendingTxDrawing[x]);
		setTimeout(function () {
			$('.txHistoryWrap').html('<div class="auditHint">Click a Marble to Audit Its Transactions</div>');//clear
		}, 750);
		$('#marbleId').html('-');
		auditingMarble = null;

		setTimeout(function () {
			$('#rightEverything').removeClass('rightEverythingOpened');
		}, 500);
		$('#leftEverything').fadeOut();
	});

	$('#auditButton').click(function () {
		$('#auditContentWrap').fadeIn();
		$('#rightEverything').addClass('rightEverythingOpened');
		$('#leftEverything').fadeIn();
	});

	let selectedOwner = null;
	// show dialog to confirm if they want to disable the marble owner
	$(document).on('click', '.disableOwner', function () {
		$('#disableOwnerWrap, #tint').fadeIn();
		selectedOwner = $(this).parents('.marblesWrap');
	});

	// disable the marble owner 禁用大理石主人
	$('#removeOwner').click(function () {
		var obj = {
			type: 'disable_owner',
			owner_id: selectedOwner.attr('owner_id')
		};
		ws.send(JSON.stringify(obj));
		selectedOwner.css('opacity', 0.4);
	});

	$('.closeDisableOwner, #removeOwner').click(function () {
		$('#disableOwnerWrap, #tint').fadeOut();
	});
	//关闭蒙版
	$(".gbmb").click(function(){
		$('#tianchu').hide();
	});
	//注册
	$('#registered').click(function(){
		$('#tianchu').show();
		let html = `<div style="margin:30px auto; with:70%">
									用户名：<input class="zuser" type="text" value=""><br/>
									密码：&nbsp;&nbsp;&nbsp;<input class="zpass" type="password" value=""><br>
									公司：&nbsp;&nbsp;&nbsp;<input class="zcompany" type="text" value="United Marbles"><br>
									<button onclick="zc()">注册</button>
								</div>`
		$('#tianchu .mbcontent').html(html)
	});
	//权限分配
	$('#posi').click(function(){
		$('#tianchu').show();
		$('#tianchu .mbcontent').html(qxfp(soData));
	});
	//登陆
	$('input[name="username"]').on('input',function(){
		let v = $(this).val();
		let l = soData.everything.owners;
		for (let i = 0; i < l.length; i++) {
			if(l[i].username == v){
				let id = l[i].id;
				//alert(v)
				var obj = {
					type: 'login',
					user_id: id
				};
				ws.send(JSON.stringify(obj));
			}
		}
	});
	$('input[name="username"]').on('blur',function(){
		let v = $(this).val();
		let l = soData.everything.owners;
		for (let i = 0; i < l.length; i++) {
			if(l[i].username == v){
				let id = l[i].id;
				//alert(v)
				var obj = {
					type: 'login',
					user_id: id
				};
				ws.send(JSON.stringify(obj));
			}
		}
	});
	$('input[name="password"]').on('blur',function(){
		//console.log($(this).val(),'_**_',loginVla);
		if($(this).val() == loginVla.data.parsed.password){
			$('#login').attr('disabled',false);
		}else {
			alert('密码错误');
		}
	});
//加载结束
});


//权限分配
function qxfp(data){
	let html = '';
	let ndata = data.everything.owners
	for (var i = 0; i < ndata.length; i++) {
		html += `<option value ="`+ndata[i].id+`">`+ndata[i].username+`</option>`;
	}
	html = `<div style="margin:30px auto; with:70%"><select class="nuserid">`+html+`</select>:<select class="nposi"><option value ="2">审批员</option><option value="1">普通用户</option></select><br/><button onclick="fp()">确认</button></div>`;
	return html;
}
//注册
function zc(){
	if($('.zuser').val()!= "" && $('.zpass').val() != "" && $('.zcompany').val() != ""){
		var obj = {
			type: 'register',
			user_name:$('.zuser').val(),
			user_pass:$('.zpass').val(),
			user_company:$('.zcompany').val()
		};
		ws.send(JSON.stringify(obj));
	}
}
//权限分配
function fp(){
	var obj = {
		type: 'identity',
		wner_id:$('.nuserid').val(),
		authed_by_company:$('.nposi').val()
	};
	ws.send(JSON.stringify(obj));
}
//toggle story mode
function set_story_mode(setting) {
	if (setting === 'on') {
		fromLS.story_mode = true;
		$('#enableStoryMode').prop('disabled', true);
		$('#disableStoryMode').prop('disabled', false);
		$('#storyStatus').addClass('storyOn').html('on');
		window.localStorage.setItem(lsKey, JSON.stringify(fromLS));		//save
	}
	else {
		fromLS.story_mode = false;
		$('#disableStoryMode').prop('disabled', true);
		$('#enableStoryMode').prop('disabled', false);
		$('#storyStatus').removeClass('storyOn').html('off');
		window.localStorage.setItem(lsKey, JSON.stringify(fromLS));		//save
	}
}
