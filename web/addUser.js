function addUser() {
  var userJson = {};
  userJson.email = $('#email').val();
  userJson.firstName = $('#firstName').val();
  userJson.lastName = $('#lastName').val();
  userJson.phoneNumber = $('#phoneNumber').val();
  userJson.password = $('#password').val();
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
