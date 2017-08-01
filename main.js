var path     = require('path');
var url      = require('url');
var electron = require('electron');

var app = electron.app;
var mainWindow = null;

function createWindow () {
	mainWindow = new electron.BrowserWindow({ width: 800, height: 470, resizable: false });

	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'app/index.html'),
		protocol: 'file:',
		slashes:  true
	}));
	mainWindow.setMenu(null);

	// comment out if you need devTools for browser window
	// mainWindow.webContents.openDevTools({ mode: 'detach' });

	mainWindow.webContents.on('did-finish-load', function onReady() {
		mainWindow.webContents.send('argv', JSON.stringify(process.argv));
	});

	mainWindow.on('closed', function onClosed() {
		mainWindow = null;
	});
}

exports.quit = function () {
	app.quit();
	mainWindow = null;
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
	app.quit();
});

app.on('activate', function () {
	if (mainWindow === null) createWindow();
});