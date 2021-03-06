var fbobj;
var socket;
var players = {};
var game;
var trader;
var leftplayer;
var rightplayer;
var propDatabase = {};

// the cancel button was clicked. Clear local cache of all
// relevant data and send the other player a tradeCancel command
function cancelClicked() {
  socket.emit('tradeCancel', {
    tofbid: localStorage['tofbid']
  });
  delete localStorage["agent"];
  delete localStorage["tofbid"];
  delete localStorage["destfbid"];
  delete localStorage["originfbid"];
  delete localStorage["destsockid"];
  delete localStorage["originsockid"];
  window.location.replace("mobileHome.html");
}

// displays a list of players to select from at the beginning.
function displayPlayers() {
  playerSelect = $("#playerSelect");
  playerSelect.html(" ");
  for (fbid in players) {
    if (fbobj.id === fbid) continue;

    player = players[fbid];
    var playerCell = $("<div>").addClass("playerCell");
    var img = $("<img>").attr({
      "src" : "https://graph.facebook.com/" + fbid + "/picture?width=54&height=54"
    });
    var name = $("<h1>").html(player.username);
    var check = $("<div>").addClass("checkmark");
    var innerfbid = $("<div>").addClass("traderfbid")
                              .html(fbid)
                              .css("display", "none");
    playerCell.append(img, name, check);

    (function() {
      var curCell = playerCell;
      var fid = fbid;
      var p = player;
      curCell.click(function(){
        $(".selected").removeClass("selected");
        curCell.addClass("selected");
        traderfbid = fid;
        rightplayer = p;
      });
    })();

    playerSelect.append(playerCell);
  }
  if (localStorage["agent"] === "destination") {
    loadTradePanels();
  }
}

// setup the socket events 
function socketSetup() {
  // let the server update our socketid before continuing on.
  socket.on('reopen', function() {
    window.scrollTo(0,1);
    socket.emit('getGame', {});
  });
  
  // get the current game to access data like players and their properties
  socket.on('getGame', function (game) {
    game = game.game;
    players = game.players;
    leftplayer = game.players[fbobj.id];
    if (localStorage["agent"] === "destination") {
      rightplayer = players[localStorage["originfbid"]];
    }
    displayPlayers();
  });
  
  // someone has responded yes to our trade request.
  socket.on('tradeResponse', function (obj) {
    loadTradePanels();
  });
  
  // update the trade view with new information (selections or money changes)
  socket.on('tradeUpdate', function (obj) {
    console.log("got update", obj);
    localStorage['originsockid'] = obj.originsockid;
    localStorage['destsockid'] = obj.destsockid;
    updateTradeValues(obj.tradeobj);
  });
  
  // you got a trade offer 
  socket.on('tradeFinalize', function (obj) {
    console.log("got a trade offer of", obj);
    var tradeobj = obj.tradeobj;
    // display prompt with info.
    displayTradeOffer(tradeobj);
  });
  
  // your offer has been accepted!
  socket.on('tradeAccept', function (obj) {
    delete localStorage["agent"];
    delete localStorage["tofbid"];
    delete localStorage["destfbid"];
    delete localStorage["originfbid"];
    delete localStorage["destsockid"];
    delete localStorage["originsockid"];
    window.location.replace("mobileHome.html");
  });
  
  // the trade has been cancelled.
  socket.on('tradeCancel', function (obj) {
    delete localStorage["agent"];
    delete localStorage["tofbid"];
    delete localStorage["destfbid"];
    delete localStorage["originfbid"];
    delete localStorage["destsockid"];
    delete localStorage["originsockid"];
    window.location.replace("mobileHome.html");
  });
}

// display the trade offer to the opponent and have him / her
// accept or reject.
function displayTradeOffer(tradeobj) {
  var destoffermoney = tradeobj.destoffermoney;
  var destofferprops = tradeobj.destofferprops;
  var originoffermoney = tradeobj.originoffermoney;
  var originofferprops = tradeobj.originofferprops;
  // TODO : actually display the trade being made.
  var offer = players[localStorage['originfbid']].username.split(" ")[0] + " wants "
  if (destoffermoney === 0 && destofferprops.length === 0) {
    offer += "nothing";
  }
  if (destoffermoney !== 0) {
    offer += "$" + destoffermoney;
  }
  if (destoffermoney !== 0 && destofferprops.length === 1) {
    offer += " and ";
  } else if (destoffermoney !== 0 && destofferprops.length > 1) {
    offer += ", ";
  }
  for (var i = 0; i < destofferprops.length; i++) {
    var destprop = destofferprops[i];
    if (!destprop) continue;
    if (i === destofferprops.length - 1) {
      offer += destprop.card.title;
    } else {
      offer += destprop.card.title + ", ";
    }
  }
  offer += " for ";
  if (originoffermoney === 0 && originofferprops.length === 0) {
    offer += "nothing";
  }
  if (originoffermoney !== 0) {
    offer += "$" + originoffermoney;
  }
  if (originofferprops.length !== 0 && originoffermoney === 1) {
    offer += " and ";
  } else if (originoffermoney !== 0 && originofferprops.length > 1) {
    offer += ", ";
  }
  if (originofferprops.length !== 0) {
    for (var i = 0; i < originofferprops.length; i++) {
      var originprop = originofferprops[i];
      if (!originprop) continue;
      if (i === originofferprops.length - 1) {
        offer += originprop.card.title;
      } else {
        offer += originprop.card.title + ", "
      }
    }
  }
  offer += ". Do you accept?"
  displayPrompt(offer, function(resp) {
    if (resp) {
      socket.emit('tradeAccept', {
        tradeobj: tradeobj,
        destfbid: localStorage['destfbid'],
        originfbid: localStorage['originfbid'],
        tofbid: localStorage['tofbid']
      });
    } else {
      socket.emit('tradeReject', {
        tofbid: localStorage['tofbid']
      });
    }
  });
}


// display the properties given a property div (left or right) and
// allows players to select them depending on the property owner.
function displayProperties(properties, propDiv, clickable) {
  var moneyCell = $("<div>").addClass("propertyCell")
                            .addClass("moneyCell");
  moneyCell.append($("<div>").addClass("proptext")
                             .addClass("propname")
                             .html("Money"));
  var moneyInput = $("<input>").attr({
    "type": "text",
    "placeholder": "$0",
    "cols": "4",
    "rows": 2,
    "class": "moneyInput"
  });
  if (!clickable) {
    moneyInput.prop("disabled", true);
  }
  moneyCell.append(moneyInput);
  moneyInput.blur(function() {
    if (isNaN(this.value)) {
      this.value  = 0;
    } else if (this.value >= Number($("#traderight .playerMoney").html().split("$")[1])) {
      this.value = 0;
    }
    socket.emit('tradeUpdate', {
      destsockid: localStorage['destsockid'],
      originsockid: localStorage['originsockid'],
      agent: localStorage['agent'],
      destfbid: localStorage['destfbid'],
      originfbid: localStorage['originfbid'],
      tradeobj: {
        kind: "money",
        value: this.value,
        agent: localStorage['agent']
      }
    });
  });
  propDiv.append(moneyCell);
  for (var i = 0; i < properties.length; i++) {
    var prop = properties[i];
    if (!prop) continue;
    propDatabase[prop.card.title] = prop;

    var card = prop.card;
    var cell = $("<div>").addClass("propertyCell");
    cell.append($("<div>").addClass("stripe")
                .addClass(card.color));
    cell.append($("<div>").addClass("proptext")
                .addClass("propname")
                .html(card.title));
    var bottom = $("<div>").addClass("cellBottom");
    if (prop.owner === "Unowned") {
      bottom.append($("<span>").addClass("proptext")
                  .addClass("price")
                  .html("$" + card.price));
    } else {
      if (prop.card.color !== "utility") {
        bottom.append($("<span>").addClass("proptext")
                      .addClass("rent")
                      .html("$" + card.rent));
      }
    }
    cell.append(bottom);

    if (clickable) {
      (function() {
        var cur_prop = prop;
        var cur_cell = cell;
        var space = i;
        cur_cell.click(function() {
          if (cur_cell.hasClass("selected")) {
            console.log("sending deselected");
            cur_cell.removeClass("selected");
            socket.emit('tradeUpdate', {
              destsockid: localStorage['destsockid'],
              originsockid: localStorage['originsockid'],
              agent: localStorage['agent'],
              destfbid: localStorage['destfbid'],
              originfbid: localStorage['originfbid'],
              tradeobj: {
                kind: 'property',
                value: cur_prop,
                selected: false
              }
            });
          } else {
            console.log("sending selected");
            cur_cell.addClass("selected");
            socket.emit('tradeUpdate', {
              destsockid: localStorage['destsockid'],
              originsockid: localStorage['originsockid'],
              agent: localStorage['agent'],
              destfbid: localStorage['destfbid'],
              originfbid: localStorage['originfbid'],
              tradeobj: {
                kind: 'property',
                value: cur_prop,
                selected: true
              }
            });
          }
        });
      })();
    }

    propDiv.append(cell);
  }
}

function displayPrompt(msg, callback) {
  if (callback === undefined) {
    callback = function(bool) {
      console.log(bool);
    };
  }
  var height = $(window).height() * 0.8;
  var confirmWrapper = $("<div>").addClass("confirmWrapper");
  var blackness = $("<div>").addClass("blackness");
  if (document.documentElement.clientHeight > 268) {
    blackness.css("height", document.documentElement.height);
  } else if ($(document).height() > 268) {
    blackness.css("height", $(document).height());
  }
  confirmWrapper.append(blackness);
  var confirmbox = $("<div>").addClass("confirmbox")
                             .html($("<div>")
                                   .addClass("promptmsg")
                                   .html("<p>" + msg + "</p>"));
                             //.height(height)
                             //.width(height);
  var boxes = $("<div>").addClass("boxeyboxes");
  var yesbox = $("<div>").attr("id", "yesbox")
                         .addClass("promptbox")
                         .html("<p>&#10003;</p>");
  var nobox = $("<div>").attr("id", "nobox")
                        .addClass("promptbox")
                        .html("<p>&#10060;</p>");
  boxes.append(yesbox, nobox);
  confirmbox.append(boxes);
  confirmWrapper.append(confirmbox);
  $("#content").append(confirmWrapper);

  $("#yesbox").click(function() {
    callback(true);
    $(".confirmWrapper").remove();
  });
  $("#nobox").click(function() {
    callback(false);
    $(".confirmWrapper").remove();
  });
}

function updateTradeValues(tradeobj) {
  if (tradeobj.kind === "money") {
    $("#tradeleft .moneyInput").val(tradeobj.value);
  } else {
    var prop = tradeobj.value;
    var cells = $(".propertyCell");
    if (tradeobj.selected) {
      for (var i = 0; i < cells.length; i++) {
        var cur_cell = cells[i];
        if (prop.card.title === $(cur_cell).children(".propname").html()) {
          $(cur_cell).addClass("selected");
        }
      }
    } else {
      for (var i = 0; i < cells.length; i++) {
        var cur_cell = cells[i];
        if (prop.card.title === $(cur_cell).children(".propname").html()) {
          $(cur_cell).removeClass("selected");
        }
      }
    }
  }
}

$(document).ready(function() {
  window.addEventListener('load', function() {
    new FastClick(document.body);
  }, false);
  
  $("#tradeleft, #traderight, .chatarea, .btn").hide();
  
  if (sessionStorage !== undefined && sessionStorage.user !== undefined) {
    fbobj = JSON.parse(sessionStorage.user);
    socket = io.connect(window.location.hostname);
    socketSetup();
    socket.emit('reopen', fbobj);
  } else {
     // Load the SDK Asynchronously
    (function(d){
       var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
       if (d.getElementById(id)) {return;}
       js = d.createElement('script'); js.id = id; js.async = true;
       js.src = "//connect.facebook.net/en_US/all.js";
       ref.parentNode.insertBefore(js, ref);
     }(document));

    window.fbAsyncInit = function() {
      FB.init({
        appId      : '448108371933308', // App ID
        channelUrl : '//localhost:11611/channel.html', // Channel File
        status     : true, // check login status
        cookie     : true, // enable cookies to allow the server to access the session
        xfbml      : true  // parse XFBML
      });

      FB.getLoginStatus(function(response) {
        if (response.status === 'connected') {
          // connected
          window.scrollTo(0, 1); // scroll past broswer bar
          FB.api('/me', function(response){
            fbobj = response;
            socket = io.connect(window.location.hostname);
            socketSetup();
            socket.emit('reopen', response); // tell the server who we are.
          });
        } else {
          // not_authorized
          alert("You are not logged in");
          window.location.replace("mobile.html");
        }
      });
    };
  }
});

function tradeFinalize() {
  if (localStorage['agent'] === "destination") {
    console.log("opponent cannot send final trade offer");
    return;
  }
  var leftselectedprops = $("#tradeleft .propertyCell.selected");
  var rightselectedprops = $("#traderight .propertyCell.selected");
  var originoffermoney = Number($("#tradeleft .moneyInput").val());
  var destoffermoney = Number($("#traderight .moneyInput").val());
  var destofferprops = [];
  var originofferprops = [];
  for (var divid = 0; divid < leftselectedprops.length; divid++) {
    var propdiv = leftselectedprops[divid];
    var propname = $(propdiv).children(".propname").html();
    if (propname === undefined) continue;
    var prop = propDatabase[propname];
    originofferprops[prop.id] = prop;
  }
  for (var divid = 0; divid < rightselectedprops.length; divid++) {
    var propdiv = rightselectedprops[divid];
    var propname = $(propdiv).children(".propname").html();
    if (propname === undefined) continue;
    var prop = propDatabase[propname];
    destofferprops[prop.id] = prop;
  }
  var tradeobj = {
      "destoffermoney": destoffermoney,
      "originoffermoney": originoffermoney,
      "originofferprops": originofferprops,
      "destofferprops": destofferprops
    }
  console.log("sending a trade offer of ", tradeobj);
  socket.emit('tradeFinalize', {
    tradeobj: tradeobj,
    tofbid: localStorage["tofbid"]
  });
}

function sendMessage() {
  var message = $("#chatBox").val().trim();
  if (message !== "") {
    socket.emit('gameChat', {
      fbid: window.fbobj.id,
      message: message
    });
    $("#chatBox").val("");
  }
}

function loadTradePanels() {
  $("#playerSelect, .selectTitle, .buttons, .errormsg").hide();
  $("#tradeleft, #traderight, .btn, .chatarea").show();
  $("#tradeleft .playerName").html(leftplayer.username.split(" ")[0]);
  $("#tradeleft .playerMoney").html("$" + leftplayer.money);
  displayProperties(leftplayer.properties,
    $("#tradeleft .playerProperties"),
    (fbobj.id !== leftplayer.fbid));

  $("#traderight .playerName").html(rightplayer.username.split(" ")[0]);
  $("#traderight .playerMoney").html("$" + rightplayer.money);
  displayProperties(rightplayer.properties,
    $("#traderight .playerProperties"),
    (fbobj.id !== rightplayer.fbid));

  if (localStorage["agent"] === "destination") {
    $(".acceptbtn").remove()
  } else {
    $(".acceptbtn").click(function() {
      tradeFinalize();
    });
  }

  $("#chatform").submit(function() {
    event.preventDefault();
    sendMessage();
  });

  $(".cancelbtn").click(cancelClicked);
}

function tradeButtonHandler() {
  if ($(".selected").length !== 1) {
    $(".errormsg").html("You must select someone to trade with.");
    return;
  }
  $(".errormsg").html("Waiting for opponent to accept trade.");

  socket.emit('tradeStart', {
    originfbid: leftplayer.fbid,
    destfbid: rightplayer.fbid,
    requester: fbobj.first_name
  });
  localStorage["originfbid"] = leftplayer.fbid;
  localStorage["destfbid"] = rightplayer.fbid;
  localStorage["tofbid"] = rightplayer.fbid;
  localStorage["agent"] = "origin";
}
