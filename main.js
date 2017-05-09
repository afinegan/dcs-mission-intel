var express = require('express');
var _ = require('lodash');
var GeoJSON = require('geojson');

var app = express();
app.use('/', express.static(__dirname + '/public'));
app.listen(8080);

app.use('/scripts', express.static(__dirname + '/node_modules'));

MissionIntelApp = {};
require('./public/js/comm.js');
require('./public/js/marker.js');
require('./public/js/marker-fids.js');

var Utility = require('./public/js/utility.js');
var SIDCtable = require('./public/js/sidc.js');

var serverObject = {};
_.set(serverObject, 'units', []);
_.set(serverObject, 'requestArray', []);

var wsConnections = [];

var websocket = require('nodejs-websocket');
var server = websocket.createServer(function (conn) {

    let time = new Date();
    console.log(time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() + ' :: <- Client connected');
    wsConnections.push(conn);
    conn.on("close", function (code, reason) {
        wsConnections.splice(wsConnections.indexOf(conn), 1);

        time = new Date();
        console.log(time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() + ' :: -> Client disconnected');
    });
});



console.log(':: SERVER IS RUNNING!');

_.set(serverObject, 'unitParse', function (unit) {
    if (_.get(unit, 'action') == 'C') {
        serverObject.units[unit.unitID] = {
            unitID: _.get(unit, 'unitID'),
            type: _.get(unit, 'type'),
            coalition: _.get(unit, 'coalition'),
            lat: _.get(unit, 'lat'),
            lon: _.get(unit, 'lon'),
            playername: _.get(unit, 'playername', '')
        };

    }
    if (_.get(unit, 'action') == 'U') {
        if (_.get(serverObject.units[unit.unitID], 'lat', null) !== null && _.get(serverObject.units[unit.unitID], 'lon', null) !== null) {
            _.set(serverObject.units[unit.unitID], 'lat', _.get(unit, 'lat'));
            _.set(serverObject.units[unit.unitID], 'lon', _.get(unit, 'lon'));
        }
    }
    if (_.get(unit, 'action') == 'D') {
        delete serverObject.units[unit.unitID];
    }
    return true;
});

function toGeoJSON(dcsData) {

     console.log(dcsData);
     console.log("############################");
     //return;

    let featureCollection = [];

    dcsData.units.forEach(function (unit) {
        serverObject.unitParse(unit);
    });

    console.log('DCS unit count: '+dcsData.unitCount+' serverObj units: '+serverObject.units.length);
    serverObject.units.forEach(function (unit) {
        // DEFAULT MARKER
        let side = '0';
        let markerColor = 'rgb(252, 246, 127)';

        let _sidcObject = {};
        _sidcObject["codingScheme"] = 'S';
        _sidcObject["affiliation"] = 'U';
        _sidcObject["battleDimension"] = 'G';
        _sidcObject["status"] = '-';
        _sidcObject["functionID"] = '-----';
        _sidcObject["modifier1"] = '-';
        _sidcObject["modifier2"] = '-';

        // make a SIDC Object to store all values, so that we can override these as needed
        let lookup = SIDCtable[unit.type];
        // Check if this unit's type is defined in the table
        if (!lookup)
            return;

        for (var atr in lookup) {
            if (lookup[atr])
                _sidcObject[atr] = lookup[atr];
        }

        // OPTION: [COMMENT TO TURN OFF] SHOW AFFILIATION
        if (unit.coalition == 1) {
            markerColor = 'rgb(255, 88, 88)';
            _sidcObject["affiliation"] = 'H';
        }
        if (unit.coalition == 2) {
            markerColor = 'rgb(128, 224, 255)';
            _sidcObject["affiliation"] = 'F';
        }

        // Generate final SIDC string
        let _sidc = "";
        for (var atr in _sidcObject) {
            _sidc += _sidcObject[atr];
        }

        // Add unit to the feature collection
        featureCollection.push({
            lat: _.get(unit, 'lat'),
            lon: _.get(unit, 'lon'),
            monoColor: markerColor,
            SIDC: _sidc + '***',
            side: _.get(unit, 'coalition'),
            size: 30,
            source: 'awacs',
            type: _.get(unit, 'type'),
            name: _.get(unit, 'playername', '')
        });
    });

    let geoJSONData = GeoJSON.parse(featureCollection, {Point: ['lat', 'lon']});

    return geoJSONData;
}

function receiveDCSData(dcsData) {
    let geoJSONData = toGeoJSON(dcsData);
    for (let connection in wsConnections)
        wsConnections[connection].sendText(JSON.stringify(geoJSONData));
}

server.listen(8081);
//var dcsdr = require('./server/dcsdataretriever.js');
//dcsdr(receiveDCSData);
var sendCMD = 'SENDTHISCOMMAND';
function DCSDataRetriever(dataCallback) {

    const PORT = 3001;
    const ADDRESS = "127.0.0.1";
    var connOpen = true;
    //const ADDRESS = "89.11.174.88";
    //const ADDRESS = "51.175.54.160";
    //const PORT = 10308;

    const net = require('net');
    let buffer;

    function connect() {

        //gather request from request array
        var request = _.get(serverObject, 'requestArray[0]',"none")+"\r\n";

        const client = net.createConnection({host: ADDRESS, port: PORT}, () => {
            let time = new Date();
            console.log(time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() + ' :: Connected to DCS server!');
            connOpen = false;
            buffer = "";
        });

        client.on('connect', function() {
            client.write("INIT"+"\n");
        });

        client.on('data', (data) => {
            buffer += data;
            while ((i = buffer.indexOf("\n")) >= 0) {
                let data = JSON.parse(buffer.substring(0, i));
                dataCallback(data);
                buffer = buffer.substring(i + 1);
                client.write("NONE"+"\n");
                _.get(serverObject, 'requestArray').shift();
            }
        });

        client.on('close', () => {
            time = new Date();
            console.log(time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() + ' :: Reconnecting....');
            connOpen = true;
        });

        client.on('error', () => {
            console.log('error!');
            connOpen = true;
        });
    }

    setInterval(function(){
        if (connOpen === true) {
            connect();
        }
    }, 1 * 200);

};

DCSDataRetriever(receiveDCSData);
//dcsdr(receiveDCSData);
