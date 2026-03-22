"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = exports.PlayerRole = exports.RoomState = void 0;
var RoomState;
(function (RoomState) {
    RoomState["WAITING"] = "waiting";
    RoomState["AUCTION"] = "auction";
    RoomState["MATCH"] = "match";
    RoomState["RESULTS"] = "results";
})(RoomState || (exports.RoomState = RoomState = {}));
var PlayerRole;
(function (PlayerRole) {
    PlayerRole["BATSMAN"] = "batsman";
    PlayerRole["BOWLER"] = "bowler";
    PlayerRole["ALL_ROUNDER"] = "all_rounder";
    PlayerRole["WICKET_KEEPER"] = "wicket_keeper";
})(PlayerRole || (exports.PlayerRole = PlayerRole = {}));
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["PLAYER"] = "player";
})(UserRole || (exports.UserRole = UserRole = {}));
