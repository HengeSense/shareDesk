
///////////////////////////////////////////
//            SOCKET.IO STUFF            //
///////////////////////////////////////////
//Creating socket.io instance
var socket = new io.Socket(); 
socket.connect();

//an action has happened, send it to the server
function sendAction(action, data)
{
	console.log('--> ' + action);

	var message = { 
		action: action,
		data: data
	}

	socket.send ( message );
}


socket.on('connect', function(){ 
	console.log('successful socket.io connect');

	//let the path be the room name
	var path = location.pathname;

	//imediately join the room which will trigger the initializations
	sendAction('joinRoom', path);
});

socket.on('disconnect', function(){ 
	//alert("Server disconnected. Please reload page.");
});

socket.on('message', function(data){ 
	getMessage(data);
});

//respond to an action event
function getMessage( m )
{
	var message = m; //JSON.parse(m);
	var action = message.action;
	var data = message.data;

	//console.log('<-- ' + action);

	switch (action)
	{
		case 'roomAccept':
			//okay we're accepted, then request initialization
			//(this is a bit of unnessary back and forth but that's okay for now)
			sendAction('initializeMe', null);
			break;

		case 'roomDeny':
			//this doesn't happen yet
			break;
			
		case 'initFiles':
			initFiles(data);
			break;

		case 'moveFile':
			$("#" + data.id).animate({
				left: data.position.left+"px",
				top: data.position.top+"px" 
			}, 500);
			break;

		case 'join-announce':
			console.log('new User entered Desktop', data);
			break;

		default:
			//unknown message
			alert('unknown action: ' + JSON.stringify(message));
			break;
	}


} 

//----------------------------------
// Just Drawing a new file
//----------------------------------
function drawNewFile(id, name, x, y) {

	var fileHTML = '<div id="' + id + '" class="file draggable" ><h1>' + name + '</h1></div>',
			$file = $(fileHTML);

	$file.appendTo('#wrapper');

	$file.draggable();

	$file.animate({left:x, top:y}, Math.floor(Math.random() * 1000));


	//After a drag:
	$file.bind( "dragstop", function(event, ui) {
		console.log('dragstop', this);
		var data = {
			id: this.id,
			position: ui.position,
			oldposition: ui.originalPosition,
		};
		sendAction('moveFile', data);
	});

}

//----------------------------------
// first time init files
//----------------------------------
function initFiles( fileArray ) {
	for (i in fileArray) {
		file = fileArray[i];
		drawNewFile(file._id, file.name, file.x, file.y);
	}
}

///////////////////////////////////////////
//            Drag&Drop STUFF            //
///////////////////////////////////////////

//----------------------------------
// Uploader 
//----------------------------------

/**
* @param Event Object from FileReader on onloaded
*/
var Uploader = function() {
	
};

Uploader.prototype = {

		/**
     * Array of all files
		 * * */
		elements: [],

		 /**
     * Fills the elements array with the files data
		 * * */
    startUpload: function(files) {

			//count how many files FileReader has passed
			var readFiles = 0;
			
			// Process each of the dropped files individually
			for(var i = 0, length = files.length; i < length; i++) {
				
				var reader = new FileReader(),
						file = files[i],
						self = this;

				// Handle errors that might occur while reading the file (before upload).
				reader.onerror = function(evt) {
					var message;
					// REF: http://www.w3.org/TR/FileAPI/#ErrorDescriptions
					switch(evt.target.error.code) {
						case 1:
							message = file.name + " not found.";
							break;
						case 2:
							message = file.name + " has changed on disk, please re-try.";
							break;
						case 3:
							messsage = "Upload cancelled.";
							break;
						case 4:
							message = "Cannot read " + file.name + ".";
							break;
						case 5:
							message = "File too large for browser to upload.";
							break;
					}
					console.log(message);	
				}

				// When the file is done loading, POST to the server.
				reader.onloadend = function(evt){

					var data = evt.target.result;
					
					// Make sure the data loaded is long enough to represent a real file.
					if(data.length > 128){
						/*
						 * Per the Data URI spec, the only comma that appears is right after
						 * 'base64' and before the encoded content.
						 */
						var base64StartIndex = data.indexOf(',') + 1;
						
						/*
						 * Make sure the index we've computed is valid, otherwise something 
						 * is wrong and we need to forget this upload.
						 */
						if(base64StartIndex < data.length) {
							self.elements.push({name:file.name, size:file.size, type:file.type, data: data.substring(base64StartIndex) });
						}
					}

					//If all Files are read start sending them
					if (++readFiles == files.length) {
       	 		self.send();
     			}
					
				}

				// init the reader event handlers
				//reader.onprogress = handleReaderProgress;
				//reader.onloadend = handleReaderLoadEnd;

				// begin the read operation
				reader.readAsDataURL(file);

			}

		},

    /**
     * @param Object HTTP headers to send to the server, the key is the
     * header name, the value is the header value
     */
    headers : {},

    /**
     * @return String A random string
     */
    generateBoundary: function() {
			return "AJAX-----------------------" + (new Date).getTime();	
		},

    /**
     * Constructs the message as discussed in the section about form
     * data transmission over HTTP
     *
     * @param Array elements
     * @param String boundary
     * @return String
     */
    buildMessage : function() {
			
			var CRLF = "\r\n";
   		var parts = [];
			var boundary = this.generateBoundary();
				
			this.elements.forEach(function(element, index, all) {
				
				var part = "";
				var fieldName = 'file';

				/*
				 * Content-Disposition header contains name of the field
				 * used to upload the file and also the name of the file as
				 * it was on the user's computer.
				 */
				part += 'Content-Disposition: form-data; ';
				part += 'name="' + fieldName + '"; ';
				part += 'filename="'+ element.name + '"' + CRLF;
				
				/*
				 * Content-Type header contains the mime-type of the file
				 * to send. Although we could build a map of mime-types
				 * that match certain file extensions, we'll take the easy
				 * approach and send a general binary header:
				 * application/octet-stream
				 */
				part += "Content-Type: application/octet-stream";
				part += CRLF + CRLF; // marks end of the headers part
				
				/*
				* Field value
				*/
				part += element.data + CRLF;

				parts.push(part);
				
			});

			var request = "--" + boundary + CRLF;
      request+= parts.join("--" + boundary + CRLF);
      request+= "--" + boundary + "--" + CRLF;

    	return request;
    				
		},

    /**
     * @return null
     */
    send : function() {
			
			var boundary = this.generateBoundary(),
					contentType = "multipart/form-data; boundary=" + boundary,
					uniqueID = Math.round(Math.random()*99999999);
			
			$.ajax({
				type: 'POST',
				url: '/upload' + location.pathname + '/' + uniqueID,
				data: this.buildMessage(), // Just send the Base64 content in POST body
				processData: true,
				timeout: 60000, // 1 min timeout
				dataType: 'text', // Pure Base64 char data
				beforeSend: function onBeforeSend(xhr, settings) {
					// Put the important file data in headers
					xhr.setRequestHeader('Content-Type', contentType);
					
					// Update status
					console.log('Uploading and Processing ' + file.name + '...');
				},
				error: function onError(XMLHttpRequest, textStatus, errorThrown) {
					
					if(textStatus == "timeout") {
						console.log('Upload was taking too long and was stopped.');
					} else {
						console.log('An error occurred while uploading the image.');
					}
				},
				success: function onUploadComplete(response) {
					//response = $.parseJSON(response);

					console.log(response);
						
					// If the parse operation failed (for whatever reason) bail
					if(!response || typeof response == "undefined") {
						// Error, update the status with a reason as well.
						console.log('The server was unable to process the upload.');
						return;
					}						
				}
			}); 

		}
};

//----------------------------------
// Init Drag&Drop 
//----------------------------------

function initDnD() {

	var dropbox = document.getElementById("wrapper");

	// init event handlers
	dropbox.addEventListener("dragenter", dragEnter, false);
	dropbox.addEventListener("dragexit", dragExit, false);
	dropbox.addEventListener("dragover", dragOver, false);
	dropbox.addEventListener("drop", drop, false);
}

function dragEnter(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	//sign an drag	
}

function dragExit(evt) {
	evt.stopPropagation();
	evt.preventDefault();
}

function dragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
}

function drop(evt) {
	evt.stopPropagation();
	evt.preventDefault();

	// Get the dropped files.
	var files = evt.dataTransfer.files;
	
	// If anything is wrong with the dropped files, exit.
	if(typeof files == "undefined" || files.length == 0)
		return;

	//Start Upload
	uploader.startUpload(files);
	
}

function initBrowserWarning() {
	var isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
	var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
	
	if(!isChrome && !isFirefox)
		console.log('no browser support for drag&drop upload');
}



//Gloabl variables
uploader = null;

///////////////////////////////////////////
//           jQuery DOM Ready            //
///////////////////////////////////////////
$(function() {
	
	uploader = new Uploader();

	//Init Drag&Drop Upload
	initBrowserWarning();
	initDnD();
	
});
