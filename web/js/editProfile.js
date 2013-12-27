function getCookie(name) {
	if(document.cookie){
		var parts = document.cookie.split(name + "=");
		if (parts.length == 2)return parts.pop().split(";").shift();
	}
	return null;
}
function editProfile() {
	$('#email').removeAttr('readonly');
	$('#firstName').removeAttr('readonly');
	$('#lastName').removeAttr('readonly');
	$('[name=deviceName]').removeAttr('readonly');
	$('[name=deviceValue]').removeAttr('readonly');
	$("#sortableListOfDevices").sortable({
					disabled: false
	});
	$("#sortableListOfDevices li span").each(function(i, el) {
		$(el).addClass("ui-icon ui-icon-arrowthick-2-n-s");
	});
	$('#editProfileChanges').hide();
	$('.removeDevice').show();
	$('#addContactDeviceField').show();
	$('#saveProfileChanges').show();
	$('#deleteUserButton').show();
}
function updateUser(){
	getUserBySessionID(getCookie("sessionID"),function(userDataString){
		var userData=jQuery.parseJSON(userDataString).results[0];
		userData.email=$('#email').val();
		userData.firstName=$('#firstName').val();
		userData.lastName=$('#lastName').val();
		
		var deviceTypes = $('[name=deviceType]');
    var deviceValues = $('[name=deviceValue]');
    var deviceNames = $('[name=deviceName]');
    
    for (var i = 0; i < deviceTypes.length; i ++) {
      var deviceType = $(deviceTypes[i]).val();
      var deviceValue = $(deviceValues[i]).val();
      var deviceName =  $(deviceNames[i]).val();
      var priority = i;

      if (deviceType != "" && deviceType != undefined && deviceName != "" && deviceName != undefined) {
        userData.contactDevices[deviceName] = {
          deviceType: deviceType,
          deviceValue: deviceValue,
          priority: priority
        }
      }
    }
		
		editUser(userData, updatePriorities());
		stopUpdating();

		//console.log("test get by sessionID success");
	});
}

function updatePriorities() {
	getUserBySessionID(getCookie("sessionID"),function(userDataString){
			var userData=jQuery.parseJSON(userDataString).results[0];
			//console.log(JSON.stringify(userData));
			userData.email=$('#email').val();
			userData.firstName=$('#firstName').val();
			userData.lastName=$('#lastName').val();
			
			var deviceTypes = $('[name=deviceType]');
			$("#sortableListOfDevices li").each(function(i, el) {
				$(el).attr("priority", i);
				var priority = i;
				var deviceType = $(deviceTypes[i]).val();
				var deviceName = this.id;
				var deviceValue = $(el).attr("number");


				console.log(deviceType + " type, " + deviceName + " name, " + deviceValue + " value, " + priority + " priority");
				if (deviceType != "" && deviceType != undefined && deviceName != "" && deviceName != undefined) {
				  userData.contactDevices[deviceName] = {
				    deviceType: deviceType,
				    deviceValue: deviceValue,
				    priority: priority
				  }
				}
			});
			editUser(userData);
	});
	stopUpdating();
}

function removeContactDevice(deviceName){
	getUserBySessionID(getCookie("sessionID"),function(userDataString){
		var userData=jQuery.parseJSON(userDataString).results[0];
		
		delete userData.contactDevices[deviceName];
		
		editUser(userData, updatePriorities);
		stopUpdating();
		//console.log("test get by sessionID success");
	});
}

function stopUpdating(){
	$('#editProfileChanges').show();
	$('#saveProfileChanges').hide();
	$('#deleteUserButton').hide();
	$(".removeDevice").hide();
	$(".deviceSelector").remove();
	$('#email').attr('readonly',true);
	$('#firstName').attr('readonly',true);
	$('#lastName').attr('readonly',true);
	$('[name=deviceName]').attr('readonly',true);
	$('[name=deviceValue]').attr('readonly',true);
	$('#addContactDeviceField').hide();
	$("#sortableListOfDevices").sortable({
					disabled: true
	});
	$("#sortableListOfDevices li span").each(function(i, el) {
		$(el).removeClass("ui-icon ui-icon-arrowthick-2-n-s");
	});
	$("#newContactDeviceList li").each(function(i, el) {
		var name = $(this).children(".newDeviceName").val();
		var number = $(this).children(".newDeviceValue").val();
		$("#sortableListOfDevices").append('<li class="ui-state-default" id='+name+' number="'+number+'" priority=999><span class=""></span>'+name +' ('+number+')<button id='+name+'"-remove" value='+name+' class="btn-danger btn-sm removeDevice "' + name + '" pull-right" style="display: none;position: relative;float: right; left: 6px; bottom: 6px;">X</button><input type="hidden" class="" value="phone" name="deviceType"></li>');
	});
	$("#newContactDeviceList").empty();
}
function deleteUser(){
	deleteUserBySessionID(getCookie("sessionID"));
}
  
