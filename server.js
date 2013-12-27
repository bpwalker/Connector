var vertx = require('vertx');
var container = require('vertx/container');
var Buffer = require('vertx/buffer');
var console = require('vertx/console');
var config = require('./config');
var mustache = require('./mustache');
var base64 = require('./base64').base64;
var MONGOADDRESS = 'BConn.Persistor';
var eb = vertx.eventBus;
var spiderApi = vertx.createHttpClient().host("bcon-1.oscar.ncsu.edu").port(8580).keepAlive(false);
var irisApi = vertx.createHttpClient().host("api.inetwork.com").port(443).ssl(true).trustAll(true).keepAlive(false);

//Rooms/Users for videochat
var rooms = {}; //user key, room value
var users = {}; //sock key, room value
var busyName = {}; //name key, sock value
var busySock = {}; //sock key, name value
var phoneSessionSock = {}; //sock key, user session value ({"user":{"alias":"804xxxxxxx", "session":"identifier"}})
var callTimeouts = {}; //user key, timeout for canceling call value
var currentCalls = {}; //sock key, session data value

//Wrapper for mustache templating
function serveTemplatePage(req, fileName, template, callback) {
  vertx.fileSystem.readFile(fileName, function(err, response) {
    if (!err) {
     // console.log(JSON.stringify(mustache));
      if (template.contactDevices != undefined) {
        template.contactDeviceArray = [];
        var keys = Object.keys(template.contactDevices);
        for (var i = 0; i < keys.length; i ++) {
          console.log(template.contactDevices[keys[i]].priority + " Priority!!!");
          for (var j = 0; j < keys.length; j++) {
            if (template.contactDevices[keys[j]].priority === i) {
              console.log(keys[j] + ", i is " + j);
              template.contactDeviceArray[i] = {deviceName: keys[j], deviceType: template.contactDevices[keys[j]].deviceType, deviceValue: template.contactDevices[keys[j]].deviceValue, priority: template.contactDevices[keys[j]].priority};
              break;
            }
          }
        }

        for (var i = 0; i < keys.length; i++) {
          console.log(keys[i] + " " + template.contactDevices[keys[i]].priority);
        }

      }
      //console.log(JSON.stringify(template));
      var output = mustache.render(response.getString(0,response.length() - 1), template);
      console.log("mustache has been rendered");
	  req.response.end(output); 
    }
    else {
      req.response.sendFile("error.html");
    }
    if (callback) {
      callback(err);
    }
  });
}

function subscribeAlias(user){
  eb.send(MONGOADDRESS, {
    action: 'find',
    collection: 'aliases',
    matcher: {
      alias: user.alias
    }
  },function(aliasReply){
    //REDACTED
  });
}

//MongoDB and related MongoDB startup functions
container.deployModule('io.vertx~mod-mongo-persistor~2.0.0-final', config.mongoDBConfig, function(){
  function startSubscriptionOnServerStart(){
    eb.send(MONGOADDRESS, {
      action: 'find',
      collection: 'users',
      matcher: {}
    }, function(reply) {
      if (reply.results.length > 0) {
        for(var i in reply.results){
          subscribeAlias(reply.results[i]);
        };
      };
    });
  };

  startSubscriptionOnServerStart();
});

//Server handling
var server = vertx.createHttpServer();
console.log("Server Started");
server.requestHandler(function(req) {
	var file = '';
	var intercept = requestInterceptor(req);
	if(intercept){
		file = intercept(req);
	}else if(req.path().indexOf('..') == -1){
		file = req.path();
	}
	if(file){
		req.response.sendFile('web/' + file, "error.html");
	}
});

//Websocket handling
var websocket = vertx.createSockJSServer(server);
websocket.installApp({prefix: '/websocket'}, function(sock) {
  sock.dataHandler(function(data){
    data = JSON.parse(data);
    var intercept = websocketInterceptor(sock, data);
    if(intercept){
      var results = intercept();
    }
  });
    
  sock.endHandler(function(){
    var room = users[sock];
    if(room){
      room.broadcast(sock, {"type" : "disconnect", "message" : {"disconnect" : "disconnect"}});
      room.removeUser(sock);
      if(room.numberOfUsers() == 0 || room.owner == sock){
        console.log("Removing room: " + room.name);
        delete rooms[room.name];
      }
    }

    if(phoneSessionSock[sock]){//User was in call before disconnect
      stopPhoneCall(phoneSessionSock[sock]);
    }
    
    //Delete from busy if exists
    var username = busySock[sock];
    if(username){
      delete busySock[sock];
      delete busyName[username];
    }

    delete users[sock];
  });
});

server.listen(config.serverPort);



//Method to deal with parameters
var parseParams = function(buffer){
  var data=buffer.toString().split('&');
  //console.log(data[0]);
  var params={};
  data.forEach(function(data){
    var param=data.split('=');
    params[decodeURIComponent(param[0])]=decodeURIComponent(param[1]);    
  });
  return params;
}

// Room and interceptors
function Room(name, owner){
    this.name = name;
    this.users = [];
    this.owner = owner;

    this.broadcast = function(sock, message){
      var i = 0;
      this.users.forEach(function(user){
        i++;
        if(user != sock){
          user.write(new Buffer(JSON.stringify(message)));
        }
      });
    }

    this.removeUser = function(sock){
      console.log("Removing user");
      var index = this.users.indexOf(sock);
      if(index >= 0){
        this.users.splice(index, 1);
      }
    }

    this.addUser = function(sock){
      console.log("Adding user");
      this.users.push(sock);
    }

    this.numberOfUsers = function(){
      return this.users.length;
    }

    this.removeAllUsers = function(){
      console.log("Removing all other users except owner");
      this.users = [];
      this.users.push(this.owner);
    }
}

function getCookie(cookie,name) {
	if(cookie){
		var parts = cookie.split(name + "=");
		if (parts.length == 2)return parts.pop().split(";").shift();
	}
	return null;
}

function stopPhoneCall(user, cb){
  eb.send(MONGOADDRESS, {
    action: 'find',
    collection: 'aliases',
    matcher: {
      alias: user.alias
    }
  },function(aliasReply){
    console.log("ALIAS REPLY: " + JSON.stringify(aliasReply));
    if(aliasReply.results.length ==1){
      //redacted
    }
  });
}

function abortPhoneCall(data, sock){
  eb.send(MONGOADDRESS, {
      action: 'find',
      collection: 'users',
      matcher: {
        sessionID: getCookie(data.message.cookie,"sessionID")
      }
    },function(reply){
      //REDACTED
    }
  );
}

function requestInterceptor(req){
	var defaultPage=function(){
		console.log("index.html");
		var cookie=getCookie(req.headers().get('Cookie'),"sessionID");
		
		if(cookie){
			eb.send(MONGOADDRESS,{
				action: 'find',
				collection: 'users',
				matcher: {
					sessionID: cookie
				}
			},function(reply){
				if(reply.number=="1"){
					//req.response.sendFile('web/dashboard.html', "error.html");
					console.log("Serve template page:"+JSON.stringify(reply.results[0]));
					serveTemplatePage(req, 'web/dashboard.html', reply.results[0]);
				}else{
					console.log("entry not found in database");
					req.response.sendFile('web/index.html', "error.html");
				}
			});
      }else{
        req.response.sendFile('web/index.html', "error.html");
      }
    }
	
	var requestMap = {
    "" : defaultPage,
	"dashboard" : defaultPage,
	"index.html" : defaultPage,
    "logout" : function(){
      var cookie=getCookie(req.headers().get('Cookie'),"sessionID");
      if(cookie){
          eb.send(MONGOADDRESS,{
            action: 'find',
            collection: 'users',
            matcher: {
              sessionID: cookie
            }
          },function(reply){
            if(reply.number=="1"){
              var result=reply.results[0];
              result['sessionID']="0";
              eb.send(MONGOADDRESS, {
                action: 'save',
                collection: 'users',
                document: result
              });
            }
          });
      }
      req.response.sendFile('web/index.html', "error.html");
    },
	"login" : function(){//AJAX call to get a sessionID
		if(req.method() == "POST"){
			req.bodyHandler(function(buffer){
				var loginInfo=JSON.parse(buffer);
				console.log("loginEmail:"+loginInfo.email);
				console.log("loginPass:"+loginInfo.password);
				eb.send(MONGOADDRESS, {
					action: 'find',
					collection: 'users',
					matcher: {
						email: loginInfo.email
					}
				},function(reply){
					if(reply.number=="1"){
						var pass=reply.results[0].password;
						if(loginInfo.password==pass){
							var sessionID=Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2);
							//req.response.putHeader("Set-Cookie","sessionID="+sessionID);
							//console.log(reply.results[0]._id);  
							var userWithSessionID=reply.results[0];
							userWithSessionID['sessionID']=sessionID;
							eb.send(MONGOADDRESS, {
								action: 'save',
								collection: 'users',
								document: userWithSessionID
							});
							req.response.end("sessionID="+sessionID);
						}else{//login failed, wrong password
							req.response.end("sessionID=0");
						}
					}else{//login failed, wrong email (or duplicate emails in database)
						req.response.end("sessionID=0");
					}
				});
			});
		}
    },
    "call" : function(){
      //TODO: Make the error message on the index page with templating
      /*var user = req.path().split('/', 3)[2];
      eb.send(MONGOADDRESS,{
        action: 'find',
        collection: 'users',
        matcher: {
          email: user
        }
      },function(reply){*/
        if (req.params().get("deviceType") == 'phone') {
            console.log("phone!!!"); 
            //send it to the right file
            req.response.end();
        } else if (req.params().get("deviceType") == 'computer') {
            console.log("computer!!");
            req.response.sendFile('web/call.html', "error.html");
        } else {
            console.log("default!!");
            req.response.sendFile('web/call.html', "error.html");
        }
        /* 
        if(reply.number=="1"){
          req.response.sendFile('web/call.html', "error.html");
        }else{
          req.response.sendFile('web/index.html', "error.html");
        }
      });*/
    },
    "user" : function(){
	//If posting to /user we are saving a new user
		console.log("registering user");
		var uri = req.path().split('/');
      
		if(req.method() == "POST") {
        //Read request body
        console.log("Entering POST for user...." + JSON.stringify(uri));
        req.bodyHandler(function(buffer) {
          if (uri[2] == "addFriend") {
            console.log("adding friend...");
            
            var friend = JSON.parse(buffer);
        
            var cookie = req.headers().get('Cookie');
            var sessionID = getCookie(cookie, "sessionID");
            var friendEmail = friend.friendEmail;
            
		        eb.send(MONGOADDRESS, {
              action: 'find',
              collection: 'users',
              matcher: {
                sessionID: sessionID
              }
            }, function(reply) {
              if (reply.results.length > 0) {
                var user = reply.results[0];
                if (!user.friends) {
                  user.friends = new Array();
                }
                
                if(user.friends.indexOf(friendEmail) == -1) {
                  user.friends.push(friendEmail);
                    eb.send(MONGOADDRESS, {
                    action: 'save',
                    collection: 'users',
                    document: user
                  });
                  req.response.end(JSON.stringify({status: "success", message: "Friend Successfully Added"}));
                }
                else {
                  console.log("friend already exists");
                  req.response.end(JSON.stringify({status: "error", message: "Friend Already Exists"}));
                }
                
                
              } else {
                req.response.end("1");
              }
            });
		      }
		      else if (uri[2] == "deleteFriend") {
		        console.log("deleting friend...");
            
            var friend = JSON.parse(buffer);
        
            var cookie = req.headers().get('Cookie');
            var sessionID = getCookie(cookie, "sessionID");
            var friendEmail = friend.friendEmail;
            
		        eb.send(MONGOADDRESS, {
              action: 'find',
              collection: 'users',
              matcher: {
                sessionID: sessionID
              }
            }, function(reply) {
              if (reply.results.length > 0) {
                var user = reply.results[0];
                if (!user.friends) {
                  user.friends = new Array();
                }
                
                var friendIndex = user.friends.indexOf(friendEmail);
                if( friendIndex != -1) {
                  user.friends.splice(friendIndex, 1);
                  eb.send(MONGOADDRESS, {
                    action: 'save',
                    collection: 'users',
                    document: user
                  });
                  console.log("friend successfully deleted");
                  req.response.end(JSON.stringify({status: "success", message: "Friend Successfully Deleted"}));
                }
                else {
                  console.log("cannot delete friend that doesn't exist");
                  req.response.end(JSON.stringify({status: "error", message: "Cannot delete friend that doesn't exist"}));
                }
                
                
              } else {
                req.response.end("1");
              }
            });
		      }
		      else {
		         //Convert text body to json
          console.log(buffer);
          var newUser = JSON.parse(buffer);
          //Save json to mongodb
          //eb.send("SAVE STUFF", newUser);
          console.log(newUser.email + " here here");
          eb.send(MONGOADDRESS, {
            action: 'find',
            collection: 'users',
            matcher: {
              email: newUser.email
            }
          }, function(reply) {
            if (reply.results.length > 0) {
              console.log("User already exists!");
              req.response.end("1");
              //user with that email address already in database
            } else {
              console.log("Getting user an alias");
              eb.send(MONGOADDRESS, {
                action: 'find',
                collection: 'aliases',
                matcher: {
                  available: "1"
                }
              }, function(aliasReply) {
                if(aliasReply.results.length != 0){
                  console.log("Alias: " + aliasReply.results[0].alias);
                  alias = aliasReply.results[0];
                  newUser.alias = alias.alias; //Add alias to the new user

                  eb.send(MONGOADDRESS, {
                    action: 'save',
                    collection: 'users',
                    document: newUser
                  });

                  alias.available = "0";

                  eb.send(MONGOADDRESS, {
                    action: 'save',
                    collection: 'aliases',
                    document: alias
                  });

                  //REDACTED
                  
                  req.response.end();

                } else{
                  req.response.end("2");
                }
              });
            }
          });

		      }
        });
      } else if(req.method() == "PUT") {
        //Read request body
        req.bodyHandler(function(buffer) {
          //Convert text body to json
          console.log(buffer);
          var newUser = JSON.parse(buffer);
          //Save json to mongodb
          //eb.send("SAVE STUFF", newUser);
          console.log(newUser.email + " here here");
          eb.send(MONGOADDRESS, {
            action: 'find',
            collection: 'users',
            matcher: {
              email: newUser.email
            }
          }, function(reply) {
            if (reply.results.length > 0) {
              //user with that email address already in database
              eb.send(MONGOADDRESS, {
                  action: 'save',
                  collection: 'users',
                  document: newUser
                });
                req.response.end();
            } else {
              req.response.end("1");
            }
          });
        });
		//req.response.end();
      }else if (req.method() == "GET") {
        console.log("starting user get");
        console.log(uri[0]);
        console.log(uri[1]);
        console.log(uri[2]);
        console.log(uri[3]);
        if (uri[2] == "userId") {
          if (uri[3]) {
            console.log("about to find by userId");
            var operation = {
              action: 'find',
              collection: 'users',
              matcher: {
                _id: uri[3]
              }
            }
            if (uri[3] == "all") {
              var cookie = req.headers().get('Cookie');
              var matchSessionID;
              cookie ? matchSessionId = {sessionID: {$ne: getCookie(cookie,"sessionID")}} : matchSessionId = {};

              operation = {
                action: 'find',
                collection: 'users',
                matcher: matchSessionId
              }
            }
            eb.send(MONGOADDRESS, operation, function(reply) {
              req.response.end(JSON.stringify(reply));
              for (var i = 0; i < reply.results.length; i ++) {
                console.log(reply.results[i].email);
              }
              console.log("Just logged results");
            });
          }
        }else if (uri[2] == "email"){
          if (uri[3]){
            console.log("about to find by email");
            eb.send(MONGOADDRESS,{
              action: 'find',
              collection: 'users',
              matcher:{
                email: uri[3]
              }
            }, function(reply) {
              req.response.end(JSON.stringify(reply));
              for (var i = 0; i < reply.results.length; i ++) {
                console.log(reply.results[i].email);
              }
              console.log("Just logged results");
            });
          }
        }else if (uri[2] == "sessionID"){
          if (uri[3]){
            console.log("about to find by sessionID");
            eb.send(MONGOADDRESS,{
              action: 'find',
              collection: 'users',
              matcher:{
                sessionID: uri[3]
              }
            }, function(reply) {
              req.response.end(JSON.stringify(reply));
              for (var i = 0; i < reply.results.length; i ++) {
                console.log(JSON.stringify(reply.results[i]));
              }
              console.log("Just logged results");
            });
          }
        }
      }else if(req.method() == "DELETE") {
        if(uri[2] == "sessionID"){
          if (uri[3]){
            eb.send(MONGOADDRESS,{
              action: 'find',
              collection: 'users',
              matcher:{
                sessionID: uri[3]
              }
            }, function(userReply) {
              if(userReply.results.length == 1){
                console.log("PERMANENTLY DELETING USER: "+uri[3]);
                eb.send(MONGOADDRESS,{
                  action: 'delete',
                  collection: 'users',
                  matcher:{
                    sessionID: uri[3]
                  }
                }, function(delReply) {
                  var user = userReply.results[0];


                  //Making alias available again
                  eb.send(MONGOADDRESS, {
                    action: 'find',
                    collection: 'aliases',
                    matcher: {
                      alias: user.alias
                    }
                  },function(aliasReply){
                    if(aliasReply.results.length ==1){
                        console.log("Making alias " + user.alias + " available.");
                        var avAlias = aliasReply.results[0]
                        avAlias.available = "1";
                        
                        eb.send(MONGOADDRESS, {
                          action: 'save',
                          collection: 'aliases',
                          document: avAlias
                        });
                    }
                  });


                  //REDACTED

                  req.response.end(JSON.stringify(delReply));
                });
              } else {
                req.response.end();
              }
            });
          }
        }
      }
    },
    "alias":function(){
      console.log("adding alias");
        
      if(req.method() == "POST") {
        req.bodyHandler(function(buffer) {
          //Convert text body to json
          var newAlias = JSON.parse(buffer);
          if(newAlias.adminPassword == "bwc1234"){//Check arbitrary password to add new aliases
            for(var i in newAlias.aliases){
              //Save json to mongodb
              eb.send(MONGOADDRESS, {
                action: 'save',
                collection: 'aliases',
                document: newAlias.aliases[i]
              });
            }
          }
          req.response.end();
        });
      }
    }
  };

  return requestMap[req.path().split('/')[1]];
}


function websocketInterceptor(sock, data){
  var websocketMap = {
    "connect" : function(){
      eb.send(MONGOADDRESS, {
          action: 'find',
          collection: 'users',
          matcher: {
            sessionID: getCookie(data.message.cookie,"sessionID")
          }
        },function(reply){
          console.log("results: " + JSON.stringify(reply));
          var username = reply.results[0].email;
          //Add username of person connecting to people online
          //TODO: Remove this conditional, always override room
          if(!rooms[username]){
              console.log("Making new room for user: " + username);
              var newRoom = new Room(username, sock);
              newRoom.addUser(sock);
              rooms[username] = newRoom;
              users[sock] = newRoom;
          } else{
            //Already logged in. Add them to the room just in case somehow they connect twice via websockets
            //rooms[username].addUser(sock);
            users[sock] = rooms[username];
          }
        }
      );
    },
    "busy" : function(){
        eb.send(MONGOADDRESS, {
          action: 'find',
          collection: 'users',
          matcher: {
            sessionID: getCookie(data.message.cookie,"sessionID")
          }
        },function(reply){
          if(reply.results.length == 1){
            var username = reply.results[0].email;
            if(username){
              busyName[username] = sock; 
              busySock[sock] = username;
            }
          }
        }
      );
    },
    "accept_call" : function(){
      console.log("ACCEPTING WEB CALL");
      var room = users[sock];
      if(room){
        room.broadcast(sock, data);
      }
    },
    "start_call" : function(){
      var room = users[sock];
      if(!room){
          room = rooms[data.message.user];
      }
      if(room){
        //Room exists
        if(room.numberOfUsers() < 2){
          //add user to room
          room.addUser(sock);
          users[sock] = room;
        } else {
          //Already 2 people in room, let them know user is busy
          sock.write(new Buffer(JSON.stringify({"type" : "busy_notification", "message" : {"call_notification" : "Sorry, this user is currently busy. Please try again later."}})));
          return;
        }
		var sessionIDVal=getCookie(data.message.remoteUserName.cookie,"sessionID");
      	if (sessionIDVal) {
      	  eb.send(MONGOADDRESS,{
            action: 'find',
            collection: 'users',
            matcher: {
              sessionID: sessionIDVal
            }
          }, function(reply){
      	    delete data.message.remoteUserName.cookie;
            if(reply.number=="1"){
      		    data.message.remoteUserName.name = reply.results[0].email;
            } else{
      		    data.message.remoteUserName.name = "anonymous";	
            }
            room.broadcast(sock, data);
      	  });
      	} else {
          room.broadcast(sock,data); 
        }
      } else if(busyName[data.message.user]){ //Check if busy
        sock.write(new Buffer(JSON.stringify({"type" : "busy_notification", "message" : {"call_notification" : "Sorry, this user is currently busy. Please try again later."}})));
      } else{
        //They are calling someone not online or does not exist, for now simply notify (in future we will redirect them to home page with error message)
        eb.send(MONGOADDRESS,{
          action: 'find',
          collection: 'users',
          matcher: {
            email: data.message.user
          }
        }, function(reply){
            if(reply.number=="1"){
              sock.write(new Buffer(JSON.stringify({"type" : "offline_notification", "message" : {"call_notification" : "Sorry, this user is offline. Please try again later."}})));
              return;
            } else{
              sock.write(new Buffer(JSON.stringify({"type" : "dne_notification", "message" : {"call_notification" : "Sorry, this user does not exist. Please try again later."}})));
              return;
            }
          }
        );
      }
    },
    "candidate" : function(){
      var room = users[sock];
      if(room){
        room.broadcast(sock, data);
      }
    }, 
    "hangup" : function(){
      var room = users[sock];
      if(room){
        room.broadcast(sock, data);
        if(room.owner == sock){
          //kick everyone else from room
          room.removeAllUsers();
        } else {  
          room.removeUser(sock);
          var username = busySock[sock];
          if(username){
            delete busySock[sock];
            delete busyName[username];
          }
        }
      }
    },
    "decline" : function(){
      var room = users[sock];
      if(room){
        room.broadcast(sock, data);
      }
    },
    "checkUserStatus" : function(){
      var room = rooms[data.message.user];
      var status = 0;

      if(room){ //check if they are in a room
        if(room.numberOfUsers() < 2){
          status = 2;
        } else if(room.numberOfUsers() == 2){
          status = 1;
        }
      }

      if(busyName[data.message.user]){ //check if in busy state
        status = 1;
      }

      sock.write(new Buffer(JSON.stringify({"type" : "checkUserStatus", "message" : {"user" : data.message.user, "status" : status}})));
    },
    "accept_phonecall" : function(){

      eb.send(MONGOADDRESS, {
        action: 'find',
        collection: 'aliases',
        matcher: {
          alias: data.message.user.alias
        }
      },function(aliasReply){
        if(aliasReply.results.length ==1){
          
          phoneSessionSock[sock] = data.message.user;
          
          //REDACTED
        }
      });
    },
    "hangup_phonecall" : function(){
      var username = busySock[sock];
      if(username){
        delete busySock[sock];
        delete busyName[username];
      }
      stopPhoneCall(data.message.user);
    },
    "abort_phonecall" : function(){
      abortPhoneCall(data, sock);
    },
    "decline_phonecall" : function(){
      eb.send(MONGOADDRESS, {
        action: 'find',
        collection: 'aliases',
        matcher: {
          alias: data.message.user.alias
        }
      },function(aliasReply){
        if(aliasReply.results.length ==1){
          //REDACTED
        }
      });
    },
    "phoneCall" : function(){
      console.log("PHONECALL MESSAGE: " + data.message.cookie);
      eb.send(MONGOADDRESS, {
          action: 'find',
          collection: 'users',
          matcher: {
            sessionID: getCookie(data.message.cookie,"sessionID")
          }
        },function(reply){
          if(reply.results.length ==1){
            eb.send(MONGOADDRESS, {
                action: 'find',
                collection: 'users',
                matcher: {
                  email: data.message.user
                }
            },function(remoteReply){
              console.log("REMOTEREPLY: " + JSON.stringify(remoteReply));
              if(remoteReply.results.length ==1){
                var user = reply.results[0];
                var aliasUser = user.alias;

                eb.send(MONGOADDRESS, {
                  action: 'find',
                  collection: 'aliases',
                  matcher: {
                    alias: aliasUser
                  }
                },function(aliasReply){
                  if(aliasReply.results.length ==1){
                    console.log("ALIASREPLY: " + JSON.stringify(aliasReply));
                    var callNextNumber = function(num){
                      //Currently used to grab first random number. Discuss how to handle multiple numbers
                      //Also the JSON seems reverse, name:{type:value} is hard to iterate vs type:[{name:value},...]
                      var number;
                      var remote = remoteReply.results[0];
                      for(var key in remote.contactDevices) {
                          if(remote.contactDevices.hasOwnProperty(key)) {
                            if(remote.contactDevices[key].deviceType == "phone" && remote.contactDevices[key].priority == num){
                              number = remote.contactDevices[key].deviceValue;
                              break;
                            }
                          }
                      }

                      console.log("Number: " + number);

                      if(number){ //Check if any number was found
                        delete data.message.sdp.type;

                        //REDACTED
                      } else {
                        sock.write(new Buffer(JSON.stringify({"type" : "phonecall_not_reached", "message" : {"phonecall_not_reached" : "phonecall_not_reached"}})));
                      }
                    }
                    callNextNumber(0);
                  }else{
                    //No remote user exists
                  } 
                });
              } 
            });
          }
        }
      ); 
    },
    "start_phoneCall" : function(){
      console.log("PHONECALL MESSAGE: " + data.message.cookie);
      eb.send(MONGOADDRESS, {
          action: 'find',
          collection: 'users',
          matcher: {
            sessionID: getCookie(data.message.cookie,"sessionID")
          }
        },function(reply){
          console.log("results for phonecall: " + JSON.stringify(reply));
          if(reply.results.length ==1){
            var user = reply.results[0];
            var aliasUser = user.alias;

            eb.send(MONGOADDRESS, {
              action: 'find',
              collection: 'aliases',
              matcher: {
                alias: aliasUser
              }
            },function(aliasReply){
              if(aliasReply.results.length ==1){
                console.log("ALIASREPLY: " + JSON.stringify(aliasReply));
                //Calls 
                delete data.message.sdp.type;

                //REDACTED 
              }else{
                //No remote user exists
              } 
            });
          }
        }
      ); 
    }
  };
  return websocketMap[data.type];
}

