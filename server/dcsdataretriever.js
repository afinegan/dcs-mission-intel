module.exports = function DCSDataRetriever(dataCallback) {

    var PORT = 3001;
    var HOST = '192.168.44.65';

    var dgram = require('dgram');
    var server = dgram.createSocket('udp4');

    server.on('listening', function () {
        var address = server.address();
        console.log('UDP Server listening on ' + address.address + ":" + address.port);
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