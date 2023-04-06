var express = require('express');
var os = require('os');
var http = require('http');
var io  = require('ws');
var app2 = express();

// 네트워크 인터페이스 정보를 가져옵니다.
const ifaces = os.networkInterfaces();

var port = 9090
var host ;

// 인터페이스 정보를 순회하며 IP 주소를 가져옵니다.
Object.keys(ifaces).forEach((ifname) => {
     let alias = 0;
     ifaces[ifname].forEach((iface) => {
         // IPv4 주소만 가져옵니다.
             if (iface.family !== 'IPv4' || iface.internal !== false || iface.cidr.startsWith('172.17.')) {
                   return;
             }

             if (alias >= 1) {
                   console.log(`${ifname}:${alias}`, iface.address);
             } else {
                   console.log(ifname, iface.address);
                   host = iface.address;
             }
             ++alias;
   });
 });


const socket = new io('http://'+  host + ":" + port);


app2.get('/test', function (req, res) {
    socketr.emit('addNewWebElement', {
                         type: "application/url",
                         url: "https:naver.com",
                         id: interactor.uniqueID,
                         SAGE2_ptrName:  localStorage.SAGE2_ptrName,
                         SAGE2_ptrColor: localStorage.SAGE2_ptrColor
                         });
    res.writeHead(200, {'Content-Type': 'text/json;charset=utf-8'});
    res.end('{"testcode":"200", "text":"Electorn Test~"}');

 });
 app2.listen(8082, function () {
   console.log('test : http://127.0.0.1:8082/');
 });
