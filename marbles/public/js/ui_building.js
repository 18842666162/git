/* global bag, $, ws*/
/* global escapeHtml, toTitleCase, formatDate, known_companies, transfer_marble, record_company, show_tx_step, refreshHomePanel, auditingMarble*/
/* exported build_marble, record_company, build_user_panels, build_company_panel, build_notification, populate_users_marbles*/
/* exported build_a_tx, marbles */
console.log("_____Tenney____________________ ui_building ____________________Tenney_____");
var marbles = {};
var submitData = {};
//_____________弹出框___________________//
function myAlert(str,click,useCancel){
    var overflow="";
    var $hidder=null;
    var clickHandler=click||$.noop;
    var myClickHandler=function(){
        $hidder.remove();
        $("body").css("overflow",overflow);
        clickHandler($(this).html()=="确定");
    };
    var init=function(){
        $hidder = $("<div style='width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;text-align: center;position:fixed;left:0;top:0;'></div>");
        var $myalert = $("<div style='width:300px;position:absolute;top:30%;left:50%;margin-left:-150px;padding:20px;background:#fff;border-radius:5px;'>"+
            "<div style='padding-bottom:10px;border-bottom:1px solid #e5e5e5;font-size:20px;color:#f83;'>温馨提示</div></div>")
            .appendTo($hidder);
        $("<div style='padding:10px 0;color:#333;border-bottom:1px solid #e5e5e5;'>"+str+"</div>").appendTo($myalert);
        var $myalert_btn_div = $("<div style='padding-top:10px;'></div>").appendTo($myalert);
        var $okBtn = $("<button class='bluebg1'>确定</button>")
            .appendTo($myalert_btn_div).click(myClickHandler);
        if(useCancel){
            $okBtn.css({"width":"50%","border-right":"5px solid #fff"});
            $("<button>取消</button>")
            .appendTo($myalert_btn_div).click(myClickHandler);
        }
        overflow=$("body").css("overflow");
        $("body").css("overflow","hidden").append($hidder);
    };
    init();
}
//_________________弹出框结束___________________//

// =================================================================================
//	UI Building
// =================================================================================
//build a marble 建一个大理石
function build_marble(marble) {
	var html = '';
	var colorClass = '';
	var size = 'largeMarble';
	var auditing = '';

	marbles[marble.id] = marble;

	marble.id = escapeHtml(marble.id);
	marble.color = escapeHtml(marble.color);
	marble.owner.id = escapeHtml(marble.owner.id);
	marble.owner.username = escapeHtml(marble.owner.username);
	marble.owner.company = escapeHtml(marble.owner.company);
	var full_owner = escapeHtml(marble.owner.username.toLowerCase() + '.' + marble.owner.company);

	console.log('[ui] building marble: ', marble.color, full_owner, marble.id.substring(0, 4) + '...');
	if (marble.size == 16) size = 'smallMarble';
	if (marble.color) colorClass = marble.color.toLowerCase() + 'bg';

	if (auditingMarble && marble.id === auditingMarble.id) auditing = 'auditingMarble';

	html += '<span id="' + marble.id + '" class="ball ' + size + ' ' + colorClass + ' ' + auditing + ' title="' + marble.id + '"';
	html += ' username="' + marble.owner.username + '" company="' + marble.owner.company + '" owner_id="' + marble.owner.id + '"></span>';

	$('.marblesWrap[owner_id="' + marble.owner.id + '"]').find('.innerMarbleWrap').prepend(html);
	$('.marblesWrap[owner_id="' + marble.owner.id + '"]').find('.noMarblesMsg').hide();
	return html;
}

//redraw the user's marbles  重新绘制用户的物品
function populate_users_marbles(msg) {

	//reset
	console.log('[ui] clearing marbles for user ' + msg.owner_id);
	$('.marblesWrap[owner_id="' + msg.owner_id + '"]').find('.innerMarbleWrap').html('<i class="fa fa-plus addMarble"></i>');
	$('.marblesWrap[owner_id="' + msg.owner_id + '"]').find('.noMarblesMsg').show();

	for (var i in msg.marbles) {
		build_marble(msg.marbles[i]);
	}
}

//crayp resize - dsh to do, dynamic one
function size_user_name(name) {
	var style = '';
	if (name.length >= 10) style = 'font-size: 22px;';
	if (name.length >= 15) style = 'font-size: 18px;';
	if (name.length >= 20) style = 'font-size: 15px;';
	if (name.length >= 25) style = 'font-size: 11px;';
	return style;
}

//build all user panels  建立所有用户面板
function build_user_panels(data) {

	//reset
	console.log('[ui] clearing all user panels');
	$('.ownerWrap').html('');
	for (var x in known_companies) {
		known_companies[x].count = 0;
		known_companies[x].visible = 0;							//reset visible counts
	}

	for (var i in data) {
		var html = '';
		var colorClass = '';
		data[i].id = escapeHtml(data[i].id);
		data[i].username = escapeHtml(data[i].username);
		data[i].company = escapeHtml(data[i].company);
		record_company(data[i].company);
		known_companies[data[i].company].count++;
		known_companies[data[i].company].visible++;

		console.log('[ui] building owner panel ' + data[i].id);

		let disableHtml = '';
		if (data[i].company  === escapeHtml(bag.marble_company)) {
			disableHtml = '<span class="fa fa-trash disableOwner" title="Disable Owner"></span>';
		}

		html += `<div id="user` + i + `wrap" username="` + data[i].username + `" company="` + data[i].company +
			`" owner_id="` + data[i].id + `" class="marblesWrap ` + colorClass + `">
					<div class="legend" style="` + size_user_name(data[i].username) + `">
						` + toTitleCase(data[i].username) + `
						<span class="fa fa-thumb-tack marblesFix" title="Never Hide Owner"></span>
						` + disableHtml + `
					</div>
					<div class="innerMarbleWrap"><i class="fa fa-plus addMarble"></i></div>
					<div class="noMarblesMsg hint">lost all marbles</div>
				</div>`;

		$('.companyPanel[company="' + data[i].company + '"]').find('.ownerWrap').append(html);
		$('.companyPanel[company="' + data[i].company + '"]').find('.companyVisible').html(known_companies[data[i].company].visible);
		$('.companyPanel[company="' + data[i].company + '"]').find('.companyCount').html(known_companies[data[i].company].count);
	}

	//drag and drop marble 拖放大理石
	$('.innerMarbleWrap').sortable({ connectWith: '.innerMarbleWrap', items: 'span' }).disableSelection();
	$('.innerMarbleWrap').droppable({
		drop:
		function (event, ui) {
			var marble_id = $(ui.draggable).attr('id');

			//  ------------ Delete Marble 删除大理石 ------------ //
			if ($(event.target).attr('id') === 'trashbin') {
				console.log('removing marble', marble_id);
				show_tx_step({ state: 'building_proposal' }, function () {
					var obj = {
						type: 'delete_marble',
						id: marble_id,
						v: 1
					};
					ws.send(JSON.stringify(obj));
					$(ui.draggable).addClass('invalid bounce');
					refreshHomePanel();
				});
			}

			//  ------------ Transfer Marble 转移大理石------------ //
			else {
				var dragged_owner_id = $(ui.draggable).attr('owner_id');
				var dropped_owner_id = $(event.target).parents('.marblesWrap').attr('owner_id');

				console.log('dropped a marble', dragged_owner_id, dropped_owner_id);
				if (dragged_owner_id != dropped_owner_id) {										//only transfer marbles that changed owners
					$(ui.draggable).addClass('invalid bounce');
					transfer_marble(marble_id, dropped_owner_id);
					return true;
				}
			}
		}
	});

	//user count
	$('#foundUsers').html(data.length);
	$('#totalUsers').html(data.length);
}

//build company wrap
function build_company_panel(company) {
	company = escapeHtml(company);
	console.log('[ui] building company panel ' + company);

	var mycss = '';
	if (company === escapeHtml(bag.marble_company)) mycss = 'myCompany';

	var html = `<div class="companyPanel" company="` + company + `">
					<div class="companyNameWrap ` + mycss + `">
					<span class="companyName">集云科技&nbsp;-&nbsp;</span>
					<span class="companyVisible">0</span>/<span class="companyCount">0</span>`;
	if (company === escapeHtml(bag.marble_company)) {
		html += '<span class="fa fa-exchange floatRight"></span>';
	} else {
		html += '<span class="fa fa-long-arrow-left floatRight"></span>';
	}
	html += `	</div>
				<div class="ownerWrap"></div>
			</div>`;
	$('#allUserPanelsWrap').append(html);
}

//build a notification msg, `error` is boolean
function build_notification(error, msg) {
	var html = '';
	var css = '';
	var iconClass = 'fa-check';
	if (error) {
		css = 'warningNotice';
		iconClass = 'fa-minus-circle';
	}

	html += `<div class="notificationWrap ` + css + `">
				<span class="fa ` + iconClass + ` notificationIcon"></span>
				<span class="noticeTime">` + formatDate(Date.now(), `%M/%d %I:%m:%s`) + `&nbsp;&nbsp;</span>
				<span>` + escapeHtml(msg) + `</span>
				<span class="fa fa-close closeNotification"></span>
			</div>`;
	return html;
}


//build a tx history div
function build_a_tx(data, pos) {
	var html = '';
	var username = '-';
	var company = '-';
	var id = '-';
	if (data && data.value && data.value.owner && data.value.owner.username) {
		username = data.value.owner.username;
		company = data.value.owner.company;
		id = data.value.owner.id;
	}

	html += `<div class="txDetails">
				<div class="txCount">TX ` + (Number(pos) + 1) + `</div>
				<p>
					<div class="marbleLegend">建议记录: </div>
					<div class="marbleName txId">` + data.txId.substring(0, 14) + `...</div>
				</p>
				<p>
					<div class="marbleLegend">用户: </div>
					<div class="marbleName">` + username + `</div>
				</p>
				<p>
					<div class="marbleLegend">公司: </div>
					<div class="marbleName">` + company + `</div>
				</p>
				<p>
					<div class="marbleLegend">用户 Id: </div>
					<div class="marbleName">` + id + `</div>
				</p>
			</div>`;
	return html;
}

//_____________________user页面添加用户货物__________________________//
function bulid_user_zclb(data){
	let html = '';
	let box = $('<div class="list-style"><h3>资产列表</h3></div>');
	var data = data.everything.marbles[myname].marbles;
	let but = '';
	let zt = ''; //状态
	for (var i = 0; i < data.length; i++) {
		if(data[i].status == 1){
			zt = "无限制";
			but = '<button id="'+data[i].id+'" onclick="on_under(0,id)">上架</button>';
		}else if(data[i].status == 3){
			zt = "排卖中";
			but = '<button id="'+data[i].id+'" onclick="on_under(1,id)">下架</button>';
		}else if(data[i].status == 2){
			zt = "审核中";
		}
		html += `<div>
			            <h3>id:`+data[i].id+`<br/><span>`+myname+`<span></h3>
			            <ol>
			                <li>类型：`+data[i].docType+`</li>
			                <li>大小：`+data[i].size+`</li>
			                <li style="color:`+data[i].color+`">颜色：`+data[i].color+`</li>
											<li>价值：`+data[i].value+`</li>
											<li>状态：`+zt+`</li>
											<li>`+but+`</li>
			            </ol>
			        </div>`;
	}
	box.append(html);
	return box;
}
function on_under(x,id){
	$('#tianchu').show();
	if(x == 0){
		$('#tianchu .mbcontent').html('<span style="margin-top:50px;display:block">请输入想要换取的颜色</span></br><input type="text" wid="'+id+'" class="want_color"></br><button onclick="on_under(2,'+id+')">上架</buttom>');
	}else if(x == 1){
		//下架
		//$('#tianchu .mbcontent').html('<input type="text" class="want_color"></br><button onclick="on_under(3,'+wid+')">下架</buttom>');
	}else if(x == 2){
		//上架
		console.log($('.want_color').attr('wid'));
		$('#tianchu').hide();
		var obj = {
			type : 'on_shelf',
			marble_id : $('.want_color').attr('wid'),
			want_color : $('.want_color').val()
		}
		ws.send(JSON.stringify(obj));
	}
}
//———————————————user 交易市场————————————————————//
function bulid_user_jysc(data){
	var html = '';
	let jyLists = data.everything.auction;
	//let userLists = data.everything.owners; //获取所有用户
	let wpLists = data.everything.marbles;	//获取所有物品
	let mywp = '';
	for (let i = 0; i < wpLists[myname].marbles.length; i++) {
		mywp += `<option value ="`+wpLists[myname].marbles[i].id+`">`+wpLists[myname].marbles[i].color+`</option>`;
	}
	for (let i = 0; i < jyLists.length; i++) {
		html += `<tr>
							<td>`+jyLists[i].id+`</td>
							<td>`+jyLists[i].marble.color+`</td>
							<td>`+jyLists[i].want+`</td>
							<td><select class="wupin" value="`+wpLists[myname].marbles[0].id+`">`+mywp+`</select></td>
							<td><button id="`+jyLists[i].id+`" onclick="jh(id)">交换</button></td>
						</tr>`;
	}
	html = `<div class="list-style"><h3>交易市场</h3>
						<table>
							<thead>
								<th>交易ID</th>
								<th>颜色</th>
								<th>想要交换的颜色</th>
								<th>选择我要交换的物品</th>
								<th>操作</th>
							</thead>
							<tbody>
								`+html+`
							</tbody>
						</table>
					</div>`
	return html;
}
function jh(id){
	let auction_id = id;
	let ex_marble_id = $('#'+id).parents('tr').find('.wupin').val();
	myAlert("您确认要进行交换?",function(f){
			 if(f){
				 var obj = {
					 type : 'exchange',
					 auction_id : auction_id,
					 ex_marble_id : ex_marble_id
				 }
				 ws.send(JSON.stringify(obj));
			 }
	 },true);
}

//_____________________________user页面添加交易内容_____________________________//
function bulid_user_zcjy(data){
	var html = '';
	var htmlUser = '';
	var box = $('<div class="list-style"><h3>资产交易</h3><br/><h3 style="font-size:18px;line-height: 25px;">资产列表<br/><span style="font-size:10px;background:rgba(90,90,90,.7);padding:3px 5px;border-radius:4px">点击选择要交易的物品</span></h3></div>');
	var dataZ = data.everything.marbles[myname].marbles; //获取当前用过的所有资产
	submitData.my_id = data.everything.marbles[myname].owner_id; //获取当前用户ID
	for (let i = 0; i < dataZ.length; i++) {
		if(dataZ[i].status == 1){
			html += `<div class="wdzc" id=wp`+i+` wp_id=`+dataZ[i].id+` onclick="zcxz(id)">
				            <h3>id:`+dataZ[i].id+`<br/><span>`+myname+`<span></h3>
				            <ol>
				                <li>类型：`+dataZ[i].docType+`</li>
				                <li>价值：`+dataZ[i].size+`</li>
				                <li style="color:`+dataZ[i].color+`">颜色：`+dataZ[i].color+`</li>
				            </ol>
				        </div>`;
		}		
	}
	var dataU = data.everything.owners; //获取所有用户
	for (let i = 0; i < dataU.length; i++) {
		if (dataU[i].username == myname) {
			continue;
		}
		htmlUser += `<div class="qtyh" user_id=`+dataU[i].id+` id=yh`+i+` onclick="yh(id)">
			            <h3>__`+dataU[i].username+`__</h3>
			        	</div>`;
	}
	htmlUser = '<br/><br/><h3 style="font-size:18px;line-height: 25px;">用户列表<br/><span style="font-size:10px;background:rgba(90,90,90,.7);padding:3px 5px;border-radius:4px">点击选择要交易的用户</span></h3>'+htmlUser+'<br/><button onclick="jy()">交易</button>';
	box.append(html);
	box.append(htmlUser);
	return box;
}

function zcxz(id){
	$(".wdzc").removeClass("xzys");
	$("#"+id).addClass("xzys");
	submitData.wp_id = $("#"+id).attr('wp_id');
}
function yh(id){
	$(".qtyh").removeClass("xzys");
	$("#"+id).addClass("xzys");
	submitData.user_id = $("#"+id).attr('user_id');
}
//交易
function jy(){
	myAlert("您确认要通过申请?",function(f){
			 if(f){
				 if(submitData.wp_id&&submitData.user_id){
 					transfer_marble(submitData.wp_id, submitData.user_id);
 				}
			 }
	 },true);
}
//________________________________________________________________________________________//
// user页面添加创建资产
function bulid_user_zccj(data){
	var html = '';
	var box = $('<div class="list-style"><h3>资产创建</h3></div>');
	submitData.my_id = data.everything.marbles[myname].owner_id; //获取当前用户ID
	submitData.my_company = data.everything.marbles[myname].company;
	html += `<div>
								颜色：<input type="text" class="cjcolor" value=""><br/>
								大小：<input type="text" class="cjsize" value=""><br/>
								价值：<input type="text" value=""><br/>
								<button onclick="cj()">添加</button>
		        </div>`;
	box.append(html);
	return box;
}
//创建物品
function cj(){
	var obj = {
		type: 'create',
		color: $('.cjcolor').val(),
		size: $('.cjsize').val(),
		username: myname,
		company: submitData.my_company,
		owner_id: submitData.my_id,
		v: 1
	};

	show_tx_step({ state: 'building_proposal' }, function () {
		ws.send(JSON.stringify(obj));
		refreshHomePanel();
	});
}
//_____________________________ approval页 _____________________________//
function bulid_user_zcsp(data){
	let userLists = data.everything.owners;
	let wpLists = data.everything.marbles;
	let html = '';
	for(let i=0; i<userLists.length;i++ ){
		let userdq = userLists[i].username;
		if(wpLists[userdq].marbles){
			for (let j = 0; j < wpLists[userdq].marbles.length; j++) {
				if (wpLists[userdq].marbles[j].status == 2) {
					html += `<tr>
											<td>`+wpLists[userdq].marbles[j].id+`</td>
											<td>`+wpLists[userdq].marbles[j].color+`</td>
											<td>`+wpLists[userdq].marbles[j].size+`</td>
											<td>`+wpLists[userdq].marbles[j].value+`</td>
											<td>`+userdq+`</td>
											<td>`+userLists[i].id+`</td>
											<td>
												<span class="fa fa-check" id="1`+wpLists[userdq].marbles[j].id+`" onclick="sp(1,id)"></span>
												<span style="margin-left:20px" class="fa fa-remove" id="4`+wpLists[userdq].marbles[j].id+`" onclick="sp(4,id)"></span>
											</td>
										</tr>`
				}
			}
		}
	}
	return html;
}
//审批
function sp(s,id){
	id = id.substring(1)
	if (s == 1) {
		myAlert("您确认要通过申请?",function(f){
				 if(f){
					 var obj = {
			 			type : 'approval',
			 			marble_id : id,
			 			status : s
			 		}
					 ws.send(JSON.stringify(obj));
				 }
		 },true);
	}
	if(s == 4){
		myAlert("您确认要驳回申请?",function(f){
				 if(f){
					 var obj = {
			 			type : 'approval',
			 			marble_id : id,
			 			status : s
			 		}
					 ws.send(JSON.stringify(obj));
				 }
		 },true);
	}
}
