var socketio = require("socket.io");
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function(server) {
  io = socketio.listen(server);
  io.set("log level", 1);
  io.sockets.on("connection", function(socket) {
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);

    joinRoom(socket, "Lobby");
    handleMessageBroadcasting(socket, nickNames);

    handleNameChangeAttempts(socket, nickNames, namesUsed);

    handleRoomJoining(socket);

    socket.on("rooms", function() {
      //   socket.emit("rooms", io.sockets.manager.rooms);
      socket.emit("rooms", io.of("/").adapter.rooms);
    });

    handleClientDisconnection(socket, nickNames, namesUsed);
  });
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
  var name = "名無しの" + guestNumber + "さん";
  nickNames[socket.id] = name;
  socket.emit("namesResult", {
    success: true,
    name: name
  });
  namesUsed.push(name);
  return guestNumber + 1;
}

function joinRoom(socket, room) {
  socket.join(room);
  currentRoom[socket.id] = room;
  socket.emit("joinResult", { room: room });
  socket.broadcast.to(room).emit("message", {
    text: nickNames[socket.id] + "が入室しました" + room + "."
  });

  //   var usersInRoom = io.sockets.clients(room);
  var usersInRoom = io.of("/").in(room).clients;

  if (usersInRoom.length > 1) {
    var usersInRoomSummary = "現在ユーザーは" + room + ":";
    for (var index in usersInRoom) {
      var userSocketId = usersInRoom[index].id;
      if (userSocketId != sockeet.id) {
        if (index > 0) {
          usersInRoomSummary += ", ";
        }
        usersInRoomSummary += nickNames[userSocketId];
      }
    }
    usersInRoomSummary += ".　";
    socket.emit("message", { text: usersInRoomSummary });
  }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  socket.on("nameAttempt", function(name) {
    if (name.indexOf("Guest") == 0) {
      socket.emit("nameResult", {
        success: false,
        message: "この名前は使用できません。"
      });
    } else {
      if (namesUsed.indexOf(name) == -1) {
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        namesUsed.push(name);
        nickNames[socket.id] = name;
        delete namesUsed[previousNameIndex];

        socket.emit("nameResult", {
          success: true,
          name: name
        });
        socket.broadcast.to(currentRoom[socket.id]).emit("message", {
          text: previousName + "の名前は" + name + "に変わりました。。"
        });
      } else {
        socket.emit("nameResult", {
          success: false,
          message: "すでに使われています。"
        });
      }
    }
  });
}

function handleMessageBroadcasting(socket) {
  socket.on("message", function(message) {
    socket.broadcast.to(message.room).emit("message", {
      text: nickNames[socket.id] + ":" + message.text
    });
  });
}

function handleRoomJoining(socket) {
  socket.on("join", function(room) {
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket, room.newRoom);
  });
}

function handleClientDisconnection(socket) {
  socket.on("disconnect", function() {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}
