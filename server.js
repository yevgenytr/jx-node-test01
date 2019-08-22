const http = require('http');
const JSONStream = require('json-stream');
var fileSystem = require('fs');
const crd = require('./pipelineactivities-crd.json');
const moment = require('moment');

async function main() {
	try {
		const Client = require('kubernetes-client').Client;
		const config = require('kubernetes-client').config;
		const client = new Client({
			config: config.getInCluster(),
			version: '1.9'
		});

		// Load the CRD
		client.addCustomResourceDefinition(crd);

		//
		// Get a JSON stream for pipelineactivities events and send it to the http response
		//
		watch(client, null);

	} catch (err) {
		console.error('Error: ', err);
	}
}

/**
 * Watch the stream.
 * 
 * Kubernetes will disconnect the stream periodically, so we reconnect on the end event.
 * By default Kubernetes will return the stream history each time we connect, so to avoid this
 * we only display new events by tracking the creationTimestamp of the event, and only displaying
 * newer events.
 * 
 * @param {*} client the shared client we use to watch the stream
 * @param {*} creationTimestamp the last creationTimestamp we observed, or null if we haven't seen 
 * 								one yet
 */
function watch(client, creationTimestamp) {
	// create a stream against the watch endpoint
	const stream = client.apis['jenkins.io'].v1.watch.pipelineactivities.getStream();
	const jsonStream = new JSONStream();
	stream.pipe(jsonStream);
	jsonStream.on('data', object => {
		// Track the last seen creation time
		ct = moment(object.object.metadata.creationTimestamp);
		creationTimestamp = creationTimestamp ? creationTimestamp : ct;
		// Only log if this is a more recent event
		if (ct > creationTimestamp) {
			creationTimestamp = ct;
			console.log('New Event at', creationTimestamp.format());
			console.log(JSON.stringify(object, null, 2));
		}
	});
	jsonStream.on('end', object => {
		console.log('Reconnect stream');
		watch(client, creationTimestamp);
	});
}

main();

// Create a simple server to give the user some instructions on how to use the quickstart
var server = http.createServer(function (req, resp) {
	fileSystem.readFile('./index.html', function (error, fileContent) {
		if (error) {
			resp.writeHead(500, {
				'Content-Type': 'text/plain'
			});
			resp.end('Error');
		} else {
			resp.writeHead(200, {
				'Content-Type': 'text/html'
			});
			resp.write(fileContent);
			resp.end();
		}
	});
});

server.listen(8080);