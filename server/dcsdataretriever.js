module.exports = function DCSDataRetriever(dataCallback, ) {

    const PORT = 3001;
    const ADDRESS = "127.0.0.1";
    var connOpen = true;
    //const ADDRESS = "89.11.174.88";
    //const ADDRESS = "51.175.54.160";
    //const PORT = 10308;

    const net = require('net');
    let buffer;

    function connect() {

        const client = net.createConnection({host: ADDRESS, port: PORT}, () => {
            let time = new Date();
            console.log(time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() + ' :: Connected to DCS server!');
            connOpen = false;
            //console.log("Connected");
            buffer = "";
        });

        client.on('connect', function() {
            socket.write("TEST PAYLOAD\r\n\r\n");
        });

        client.on('data', (data) => {
            buffer += data;
            while ((i = buffer.indexOf("\n")) >= 0) {
                let data = JSON.parse(buffer.substring(0, i));
                dataCallback(data);
                buffer = buffer.substring(i + 1);
            }
        });

        client.on('close', () => {
            time = new Date();
            console.log(time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds() + ' :: Reconnecting....');
            connOpen = true;
        });

        client.on('error', () => {
            connOpen = true;
        });
    }

    setInterval(function(){
        if (connOpen === true) {
            connect();
        }
    }, 5 * 1000);

};