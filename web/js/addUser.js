function getNewAlias() {
  return 5555555555;
}

function addUser() {
  var userJson = {};
  userJson.email = $('#email').val();
  userJson.firstName = $('#firstName').val();
  userJson.lastName = $('#lastName').val();
  userJson.password = $('#password').val();
  userJson.alias = getNewAlias();
  
  var deviceTypes = $('[name=deviceType]');
  var deviceValues = $('[name=deviceValue]');
  var contactDevices = [];
  
  for (var i = 0; i < deviceTypes.length; i ++) {
            contactDevices[$(deviceNames[i]).val()] = {
              deviceType: $(deviceTypes[i]).val(),
              deviceValue: $(deviceValues[i]).val()
            }
          }
  
  userJson.contactDevices = contactDevices;
  
  console.log(userJson);
  $.ajax({  
    type: "POST",  
    url: "/user",  
    data: JSON.stringify(userJson),  
    success: function() {  
      console.log("successfully saved"); 
    }  
  }).done(function(data) {
    console.log("Add user is done");
    console.log(data);
  });
}
function login(loginJson,callback){
	console.log("login:"+JSON.stringify(loginJson));
	$.ajax({  
		type: "POST",  
		url: "/login",  
		data: JSON.stringify(loginJson),  
		success: function(data){
			callback(data);
		}
	}).complete(function(data) {
		//console.log("Add user is done");
		//console.log(data);
	});
}
function saveUser(userJson,callback) {
	console.log(userJson);
	$.ajax({  
		type: "POST",  
		url: "/user",  
		data: JSON.stringify(userJson),  
		success: callback
	}).complete(function(data) {
		//console.log("Add user is done");
		//console.log(data);
	});
}

function editUser(userJson,callback) {
	//console.log(userJson);
	$.ajax({  
		type: "PUT",  
		url: "/user",  
		data: JSON.stringify(userJson),  
		success: callback
	}).complete(function(data) {
		//console.log("Add user is done");
		//console.log(data);
	});
}

function deleteUserBySessionID(sessionID){
	$.ajax({  
	type: "DELETE",  
	url: "/user/sessionID/" + sessionID,    
	success: function(data) { 
		console.log("Delete successful"); 
	}  
	}).done(function(data) {
		console.log("Delete user done");
	});
}
function getUserById(userId, callback) {
 $.ajax({  
    type: "GET",  
    url: "/user/userId/" + userId,    
    success: function(data) { 
      callback(data); 
      //console.log(data);
      //console.log("successfully found user by id"); 
    }  
  }).done(function(data) {
    //console.log("userId done function got called");
    //console.log(data);
  });
}
function getUserBySessionID(email, callback) {
  $.ajax({  
    type: "GET",  
    url: "/user/sessionID/" + email,   
    success: function(data) { 
      callback(data); 
      //console.log(data);
      //console.log("successfully found user by sessionID"); 
    }  
  }).done(function(data) {
    //console.log("user email done function got called");
    //console.log(data);
  });
} 
function getUserByEmail(email, callback) {
  $.ajax({  
    type: "GET",  
    url: "/user/email/" + email,   
    success: function(data) { 
      callback(data); 
      //console.log(data);
      //console.log("successfully found user by email"); 
    }  
  }).done(function(data) {
    //console.log("user email done function got called");
    //console.log(data);
  });
} 
