module.exports = function DCSDataRetriever(dataCallback) {

    var PORT = 3001;
    var HOST = '127.0.0.1';

    var dgram = require('dgram');
    var server = dgram.createSocket('udp4');
    let buffer;

    server.on('listening', function () {
        var address = server.address();
        console.log('UDP Server listening on ' + address.address + ":" + address.port);
        let buffer = "";
    });

    server.on('data', (data) => {
        buffer += data;
        while ((i = buffer.indexOf("\n")) >= 0) {
            let data = JSON.parse(buffer.substring(0, i));
            dataCallback(data);
            buffer = buffer.substring(i + 1);
        }
    });

    server.on('message', function (message, remote) {
        console.log(remote.address + ':' + remote.port +' - ' + message);

    });

    server.bind(PORT, HOST);
};