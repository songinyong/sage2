// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization
// and Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-2015

/**
 * Electron SAGE2 client
 *
 * @class electron
 * @module electron
 * @submodule electron
 * @requires electron commander
 */

"use strict";

const path = require("path");
const { join } = path;
const electron = require("electron");
const querystring = require("querystring");
const fs = require("fs");

// To make it work in both files (electron.js in /sage2 and electron.js in /sage2/client)
var md5 = null;
if (__dirname.substr(__dirname.length - 6) === "client") {
  md5 = require("../src/md5");
} else {
  md5 = require("./src/md5");
}

// Get platform and hostname
var os = require("os");
const { platform, homedir } = os;

//
// handle install/update for Windows
//
if (require("electron-squirrel-startup")) {
  return;
}
// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require("child_process");
  const path = require("path");

  const appFolder = path.resolve(process.execPath, "..");
  const rootAtomFolder = path.resolve(appFolder, "..");
  const updateDotExe = path.resolve(path.join(rootAtomFolder, "Update.exe"));
  const exeName = path.basename(process.execPath);

  const spawn = function (command, args) {
    let spawnedProcess;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
    } catch (error) {
      // pass
    }

    return spawnedProcess;
  };

  const spawnUpdate = function (args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case "--squirrel-install":
    case "--squirrel-updated":
      // Install desktop and start menu shortcuts
      spawnUpdate(["--createShortcut", exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case "--squirrel-uninstall":
      // Remove desktop and start menu shortcuts
      spawnUpdate(["--removeShortcut", exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case "--squirrel-obsolete":
      app.quit();
      return true;
  }
}

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const shell = electron.shell;
// Module to handle ipc with Browser Window
const ipcMain = electron.ipcMain;

// parsing command-line arguments
var program = require("commander");
// get hardware and performance data
var si = require("systeminformation");
// Get the version from the package file
var version = require("./package.json").version;

/**
 * Setup the command line argument parsing (commander module)
 */
var args = process.argv;
// if (args.length === 1) {
// 	// seems to make commander happy when using binary packager
// 	args = args[0];
// }

// Generate the command line handler
program
  .version(version)
  .option("-a, --audio", "Open the audio manager (instead of display)", false)
  .option("-d, --display <n>", "Display client ID number (int)", parseInt, 0)
  .option("-f, --fullscreen", "Fullscreen (boolean)", false)
  .option("-m, --monitor <n>", "Select a monitor (int)", myParseInt, null)
  .option("-n, --no_decoration", "Remove window decoration (boolean)", false)
  .option("-p, --plugins", "Enables plugins and flash (boolean)", false)
  .option("-s, --server <s>", "Server URL (string)", "http://localhost:9292")
  .option("-u, --ui", "Open the user interface (instead of display)", false)
  .option("-x, --xorigin <n>", "Window position x (int)", myParseInt, 0)
  .option("-y, --yorigin <n>", "Window position y (int)", myParseInt, 0)
  .option("--allowDisplayingInsecure", "Allow displaying of insecure content (http on https)", true)
  .option("--allowRunningInsecure", "Allow running insecure content (scripts accessed on http vs https)", true)
  .option("--no-cache", "Do not clear the cache at startup", true)
  .option("--console", "Open the devtools console", false)
  .option("--debug", "Open the port debug protocol (port number is 9222 + clientID)", false)
  .option("--experimentalFeatures", "Enable experimental features", false)
  .option("--hash <s>", "Server password hash (string)", null)
  .option("--height <n>", "Window height (int)", myParseInt, 720)
  .option("--password <s>", "Server password (string)", null)
  .option("--disable-hardware", "Disable hardware acceleration", false)
  .option("--show-fps", "Display the Chrome FPS counter", false)
  .option("--width <n>", "Window width (int)", myParseInt, 1280)
  .parse(args);

// Parse the arguments
program.parse(args);
// Get the results
const commander = program.opts();

// // Change current durectory to find the Webview JS addon
// 	// if (os.platform() === "win32" || os.platform() === "darwin") {
// 	console.log('Current directory:', process.cwd());
// 	console.log('getAppPath directory:', electron.app.getAppPath());
// 	electron.app.setAppPath(process.cwd());
// 	// }

// Disable hardware rendering (useful for some large display systems)
if (commander.disableHardware) {
  app.disableHardwareAcceleration();
}

// Load the flash plugin if asked
if (commander.plugins) {
  // Flash loader
  const flashLoader = require("flash-player-loader");

  flashLoader.debug({ enable: true });
  if (process.platform === "darwin") {
    flashLoader.addSource("@chrome");
  }
  flashLoader.addSource("@system");
  flashLoader.load();
}

// Reset the desktop scaling
app.commandLine.appendSwitch("force-device-scale-factor", "1");

// As of 2019, video elements with sound will no longer autoplay unless user interacted with page.
// switch found from: https://github.com/electron/electron/issues/13525/
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Remove the limit on the number of connections per domain
//  the usual value is around 6
const url = require("url");
console.log(electron.screen.getAllDisplays());
console.log("SERVER", commander.server);
var parsedURL = new url.URL(commander.server);
// default domais are local
var domains = "localhost,127.0.0.1";
// Store current site domain
var currentDomain = parsedURL.hostname;
// Filename of favorite sites file
const favorites_file_name = "sage2_favorite_sites.json";
//JS object containing list of favorites sites
var favorites = {
  list: [],
};

if (parsedURL.hostname) {
  // add the hostname
  domains += "," + parsedURL.hostname;
}
app.commandLine.appendSwitch("ignore-connections-limit", domains);

// For display clients, ignore certificate errors
app.commandLine.appendSwitch("ignore-certificate-errors");

// Enable the Chrome builtin FPS display for debug
if (commander.showFps) {
  app.commandLine.appendSwitch("show-fps-counter");
}

// Enable port for Chrome DevTools Protocol to control low-level
// features of the browser. See:
// https://chromedevtools.github.io/devtools-protocol/
if (commander.debug) {
  // Common port for this protocol
  let port = 9222;
  // Offset the port by the client number, so every client gets a different one
  port += commander.display;
  // Add the parameter to the list of options on the command line
  app.commandLine.appendSwitch("remote-debugging-port", port.toString());
}

/**
 * Keep a global reference of the window object, if you don't, the window will
 * be closed automatically when the JavaScript object is garbage collected.
 */
var mainWindow;
var remoteSiteInputWindow;

/**
 * Opens a window.
 *
 * @method     openWindow
 */
function openWindow() {
  if (!commander.fullscreen) {
    mainWindow.show();
  }

  if (commander.audio) {
    if (commander.width === 1280 && commander.height === 720) {
      // if default values specified, tweak them for the audio manager
      commander.width = 800;
      commander.height = 400;
    }
    mainWindow.minimize();
  }

  // Setup initial position and size
  mainWindow.setBounds({
    x: commander.xorigin,
    y: commander.yorigin,
    width: commander.width,
    height: commander.height,
  });

  // Start to build a URL to load
  var location = commander.server;

  // Test if we want an audio client
  if (commander.audio) {
    location = location + "/audioManager.html";
    if (commander.hash) {
      // add the password hash to the URL
      location += "?hash=" + commander.hash;
    } else if (commander.password) {
      // add the password hash to the URL
      location += "?session=" + commander.password;
    }
  } else if (commander.ui) {
    // or an UI client
    location = location + "/index.html";
    if (commander.hash) {
      // add the password hash to the URL
      location += "?hash=" + commander.hash;
    } else if (commander.password) {
      // add the password hash to the URL
      location += "?session=" + commander.password;
    }
  } else {
    // and by default a display client
    location = location + "/display.html?clientID=" + commander.display;
    if (commander.hash) {
      // add the password hash to the URL
      location += "&hash=" + commander.hash;
    } else if (commander.password) {
      // add the password hash to the URL
      location += "?session=" + commander.password;
    }
  }
  mainWindow.loadURL(location);

  if (commander.monitor !== null) {
    mainWindow.on("show", function () {
      mainWindow.setFullScreen(true);
      // Once all done, prevent changing the fullscreen state
      mainWindow.fullScreenable = false;
    });
  } else {
    // Once all done, prevent changing the fullscreen state
    mainWindow.fullScreenable = false;
  }
}

/**
 * Gets the windows path to a temporary folder to store data
 *
 * @return {String} the path
 */
function getWindowPath() {
  return join(homedir(), "AppData");
}

/**
 * Gets the Mac path to a temporary folder to store data (/tmp)
 *
 * @return {String} the path
 */
function getMacPath() {
  return "/tmp";
}

/**
 * Gets the Linux path to a temporary folder to store data
 *
 * @return {String} the path
 */
function getLinuxPath() {
  return join(homedir(), ".config");
}

/**
 * In case the platform is among the known ones (for the potential
 * future os platforms)
 *
 * @return {String} the path
 */
function getFallback() {
  if (platform().startsWith("win")) {
    return getWindowPath();
  }
  return getLinuxPath();
}

/**
 * Creates the path to the file in a platform-independent way
 *
 * @param  {String} file_name the name of the file
 * @return the path to the file
 */
function getAppDataPath(file_name) {
  let appDataPath = "";
  switch (platform()) {
    case "win32":
      appDataPath = getWindowPath();
      break;
    case "darwin":
      appDataPath = getMacPath();
      break;
    case "linux":
      appDataPath = getLinuxPath();
      break;
    default:
      appDataPath = getFallback();
  }
  if (file_name === undefined) {
    return appDataPath;
  } else {
    return join(appDataPath, file_name);
  }
}

/**
 * Creates an electron window.
 *
 * @method     createWindow
 */
function createWindow() {
  // Build a menu
  var menu = buildMenu();
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

  // If a monitor is specified
  if (commander.monitor !== null) {
    // get all the display data
    let displays = electron.screen.getAllDisplays();
    // get the bounds of the interesting one
    let bounds = displays[commander.monitor].bounds;
    // overwrite the values specified
    commander.width = bounds.width;
    commander.height = bounds.height;
    commander.xorigin = bounds.x;
    commander.yorigin = bounds.y;
    commander.no_decoration = true;
  }

  // Create option data structure
  var options = {
    width: commander.width,
    height: commander.height,
    frame: !commander.no_decoration,
    fullscreen: commander.fullscreen,
    show: !commander.fullscreen,
    autoHideMenuBar: commander.audio,
    fullscreenable: commander.fullscreen,
    alwaysOnTop: commander.fullscreen,
    kiosk: commander.fullscreen,
    // a default color while loading
    backgroundColor: "#565656",
    // resizable: !commander.fullscreen,
    webPreferences: {
      // Enable webviews
      webviewTag: true,
      // Disable alert and confirm dialogs
      disableDialogs: true,
      nodeIntegration: true,
      webSecurity: true,
      backgroundThrottling: false,
      plugins: commander.plugins,
      allowDisplayingInsecureContent: commander.allowDisplayingInsecure,
      allowRunningInsecureContent: commander.allowRunningInsecure,
      // this enables things like the CSS grid. add a commander option up top for enable / disable on start.
      experimentalFeatures: commander.experimentalFeatures ? true : false,
    },
  };

  if (process.platform === "darwin") {
    // noting for now
  } else {
    options.titleBarStyle = "hidden";
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(options);

  if (commander.cache) {
    // clear the caches, useful to remove password cookies
    const session = electron.session.defaultSession;
    session
      .clearStorageData({
        storages: ["appcache", "cookies", "local storage", "serviceworkers"],
      })
      .then(() => {
        console.log("Electron>	Caches cleared");
        openWindow();
      });
  } else {
    openWindow();
  }

  // When the webview tries to download something
  electron.session.defaultSession.on("will-download", (event, item, webContents) => {
    // do nothing
    event.preventDefault();
    // send message to the render process (browser)
    mainWindow.webContents.send("warning", "File download not supported");
  });

  // Mute the audio (just in case)
  var playAudio = commander.audio || commander.display === 0;
  mainWindow.webContents.audioMuted = !playAudio;

  // Open the DevTools.
  if (commander.console) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object
    mainWindow = null;
  });

  // when the display client is loaded
  mainWindow.webContents.on("did-finish-load", function () {
    // Get the basic information of the system
    si.getStaticData(function (data) {
      // Send it to the page, since it has the connection
      // to the server
      data.hostname = os.hostname();
      // fix on some system with no memory layout
      if (data.memLayout.length === 0) {
        si.mem(function (mem) {
          data.memLayout[0] = { size: mem.total };
          // send data to the HTML page, ie SAGE2_Display.js
          mainWindow.webContents.send("hardwareData", data);
        });
      } else {
        // send data to the HTML page, ie SAGE2_Display.js
        mainWindow.webContents.send("hardwareData", data);
      }
    });
  });

  // If the window opens before the server is ready,
  // wait 2 sec. and try again
  mainWindow.webContents.on("did-fail-load", function (ev) {
    setTimeout(function () {
      mainWindow.reload();
    }, 2000);
  });

  mainWindow.webContents.on("will-navigate", function (ev) {
    // ev.preventDefault();
  });

  // New webview going to be added
  // var partitionNumber = 0;
  mainWindow.webContents.on("will-attach-webview", function (event, webPreferences, params) {
    // Load the SAGE2 addon code
    webPreferences.preloadURL = "file://" + path.join(__dirname + "/public/uploads/apps/Webview/SAGE2_script_supplement.js");

    // Disable alert and confirm dialogs
    webPreferences.disableDialogs = true;

    // Override the plugin value
    params.plugins = commander.plugins;

    // Override the UserAgent variable: make websites behave better
    // Not permanent solution: here pretending to be Firefox
    params.useragent = "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:46.0) Gecko/20100101 Firefox/76.0";

    /*
		// In client code now, electron version >= 7
		// Parse the URL
		let destination = url.parse(params.src);
		// Get the domain
		let hostname = destination.host || destination.hostname;

		// Special partitions to keep login info (wont work with multiple accounts)
		if (hostname.endsWith("sharepoint.com") ||
			hostname.endsWith("live.com") ||
			hostname.endsWith("office.com")) {
			params.partition = 'persist:office';
		} else if (hostname.endsWith("appear.in") || hostname.endsWith("whereby.com")) {
			// VTC
			params.partition = 'persist:whereby';
		} else if (hostname.endsWith("youtube.com")) {
			// VTC
			params.partition = 'persist:youtube';
		} else if (hostname.endsWith("github.com")) {
			// GITHUB
			params.partition = 'persist:github';
		} else if (hostname.endsWith("google.com")) {
			// GOOGLE
			params.partition = 'persist:google';
		} else {
			// default isolated partitions
			params.partition = 'partition_' + partitionNumber;
			partitionNumber = partitionNumber + 1;
		}
		*/
  });

  mainWindow.webContents.on("did-attach-webview", function (event, webContents) {
    // New webview added and completed
  });

  // Catch the close connection page event
  ipcMain.on("close-connect-page", (e, value) => {
    remoteSiteInputWindow.close();
  });

  // Catch remote URL to connect to
  ipcMain.on("connect-url", (e, URL) => {
    var location = URL;
    // Update current domain
    currentDomain = url.parse(URL).hostname;
    var queryParams = querystring.parse(url.parse(URL).query);
    // If a password is provided, the md5 hash needed to connect to the site is stored locally
    if (queryParams.session) {
      var hash = generatePasswordHash(queryParams.session);
      fs.readFile(getAppDataPath(favorites_file_name), "utf8", function readFileCallback(err, data) {
        if (err) {
          // most likely no json file (first use), write empty favorites on file
          console.log(err);
        } else {
          favorites = JSON.parse(data); //convert json to object
          for (let i = 0; i < favorites.list.length; i++) {
            if (favorites.list[i].host === currentDomain) {
              favorites.list[i].hash = hash;
            }
          }
          writeFavoritesOnFile(favorites);
        }
      });
    }
    // Close input window
    if (remoteSiteInputWindow) {
      remoteSiteInputWindow.close();
    }
    mainWindow.loadURL(location);
  });

  ipcMain.on("getPerformanceData", function () {
    var perfData = {};
    var mem = process.getSystemMemoryInfo();
    perfData.mem = {
      total: mem.total,
      free: mem.free,
    };
    var displayLoad = {
      cpuPercent: 0,
      memPercent: 0,
      memResidentSet: 0,
    };

    var procCPU = process.getCPUUsage();
    displayLoad.cpuPercent = procCPU.percentCPUUsage;

    // Get the version number for Electron
    let electronVersion = process.versions.electron;
    // Parse the string and get the Major version number
    let majorVersion = parseInt(electronVersion.split(".")[0]);
    if (majorVersion < 4) {
      // for version 3 and below
      let procMem = process.getProcessMemoryInfo();
      displayLoad.memResidentSet = procMem.workingSetSize;
      displayLoad.memPercent = (procMem.workingSetSize / perfData.mem.total) * 100;
    } else {
      // version 4 has new APIs
      let metrics = app.getAppMetrics();
      metrics.forEach(function (m) {
        // pid Integer - Process id of the process.
        // type String - Process type (Browser or Tab or GPU etc).
        // memory MemoryInfo - Memory information for the process.
        // cpu CPUUsage - CPU usage of the process.
        if (m.pid === process.pid) {
          // Not Yet Implemented in beta3
          // console.log('V4', m.memory);
        }
      });
    }

    // CPU Load
    si.currentLoad(function (data) {
      perfData.cpuLoad = {
        raw_currentload: data.raw_currentload,
        raw_currentload_idle: data.raw_currentload_idle,
      };
      perfData.processLoad = displayLoad;
      mainWindow.webContents.send("performanceData", perfData);
    });
  });
}

/**
 * Writes favorites in a persistent way on local machine
 *
 * @method writeFavoritesOnFile
 * @param {Object} favorites_obj the object containing the list of favorites
 */
function writeFavoritesOnFile(favorites_obj) {
  fs.writeFile(getAppDataPath(favorites_file_name), JSON.stringify(favorites_obj), "utf8", () => {});
}

/**
 * Dealing with certificate issues
 * used to be done in Webview app but seems to work better here now
 */
app.on("certificate-error", function (event, webContent, url, error, certificate, callback) {
  // This doesnt seem like a security risk yet
  if (error === "net::ERR_CERTIFICATE_TRANSPARENCY_REQUIRED") {
    // console.log('Webview> certificate error ERR_CERTIFICATE_TRANSPARENCY_REQUIRED', url);
    // we ignore the certificate error
    event.preventDefault();
    callback(true);
  } else if (error === "net::ERR_CERT_COMMON_NAME_INVALID") {
    // self-signed certificate
    // console.log('Webview> certificate error ERR_CERT_COMMON_NAME_INVALID', url)
    // we ignore the certificate error
    event.preventDefault();
    callback(true);
  } else if (error === "net::ERR_CERT_AUTHORITY_INVALID") {
    // self-signed certificate
    // console.log('Webview> certificate error ERR_CERT_AUTHORITY_INVALID', url)
    // we ignore the certificate error
    event.preventDefault();
    callback(true);
  } else {
    // More troubling error
    console.log("Webview> certificate error", error, url);
    // Denied
    callback(false);
  }
});

/**
 * This method will be called when Electron has finished
 * initialization and is ready to create a browser window.
 */
app.on("ready", createWindow);

/**
 * Quit when all windows are closed.
 */
app.on("window-all-closed", function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * activate callback
 * On OS X it's common to re-create a window in the app when the
 * dock icon is clicked and there are no other window open.
 */
app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Utiltiy function to parse command line arguments as number
 *
 * @method     myParseInt
 * @param      {String}    str           the argument
 * @param      {Number}    defaultValue  The default value
 * @return     {Number}    return an numerical value
 */
function myParseInt(str, defaultValue) {
  var int = parseInt(str, 10);
  if (typeof int == "number") {
    return int;
  }
  return defaultValue;
}

/**
 * Creates a remote site input window.
 *
 * @method     createRemoteSiteInputWindow
 */
function createRemoteSiteInputWindow() {
  // creating a new window
  remoteSiteInputWindow = new BrowserWindow({
    width: 3840,
    height:2160,
    frame: false,
    title: "Connect to Remote Site",
    webPreferences: {
      nodeIntegration: true,
      webSecurity: true,
    },
  });
  // Load html into window
  remoteSiteInputWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "remoteSiteWindow.html"),
      protocol: "file",
      slashes: true,
    })
  );
  setTimeout(() => {
    remoteSiteInputWindow.webContents.send("current-location", currentDomain);
  }, 1000);

  // Garbage collection for window (when add window is closed the space should be deallocated)
  remoteSiteInputWindow.on("closed", () => {
    remoteSiteInputWindow = null;
  });

  // No menu needed in this window
  remoteSiteInputWindow.setMenu(null);
}

/**
 * Generates the md5 hash of a string, used to hash the password
 * @param  {String} password
 * @return the hash of the password
 */
function generatePasswordHash(password) {
  return md5.getHash(password);
}

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Connect to Remote Site",
          accelerator: process.platform === "darwin" ? "Command+K" : "Ctrl+K",
          click() {
            createRemoteSiteInputWindow();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          role: "undo",
        },
        {
          label: "Redo",
          accelerator: "Shift+CmdOrCtrl+Z",
          role: "redo",
        },
        {
          type: "separator",
        },
        {
          label: "Cut",
          accelerator: "CmdOrCtrl+X",
          role: "cut",
        },
        {
          label: "Copy",
          accelerator: "CmdOrCtrl+C",
          role: "copy",
        },
        {
          label: "Paste",
          accelerator: "CmdOrCtrl+V",
          role: "paste",
        },
        {
          label: "Select All",
          accelerator: "CmdOrCtrl+A",
          role: "selectall",
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: function (item, focusedWindow) {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          },
        },
        {
          label: "Toggle Full Screen",
          accelerator: (function () {
            if (process.platform === "darwin") {
              return "Ctrl+Command+F";
            } else {
              return "F11";
            }
          })(),
          click: function (item, focusedWindow) {
            if (focusedWindow) {
              focusedWindow.fullScreenable = !focusedWindow.isFullScreen();
            }
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator: (function () {
            if (process.platform === "darwin") {
              return "Alt+Command+I";
            } else {
              return "Ctrl+Shift+I";
            }
          })(),
          click: function (item, focusedWindow) {
            if (focusedWindow) {
              focusedWindow.toggleDevTools();
            }
          },
        },
      ],
    },
    {
      label: "Window",
      role: "window",
      submenu: [
        {
          label: "Minimize",
          accelerator: "CmdOrCtrl+M",
          role: "minimize",
        },
        {
          label: "Close",
          accelerator: "CmdOrCtrl+W",
          role: "close",
        },
      ],
    },
    {
      label: "Help",
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: function () {
            shell.openExternal("http://sage2.sagecommons.org/v4-0-release/sage2-display-client/");
          },
        },
      ],
    },
  ];

  if (process.platform === "darwin") {
    const name = app.name;
    template.unshift({
      label: name,
      submenu: [
        {
          label: "About " + name,
          role: "about",
        },
        {
          type: "separator",
        },
        {
          label: "Services",
          role: "services",
          submenu: [],
        },
        {
          type: "separator",
        },
        {
          label: "Hide " + name,
          accelerator: "Command+H",
          role: "hide",
        },
        {
          label: "Hide Others",
          accelerator: "Command+Shift+H",
          role: "hideothers",
        },
        {
          label: "Show All",
          role: "unhide",
        },
        {
          type: "separator",
        },
        {
          label: "Quit",
          accelerator: "Command+Q",
          click: function () {
            app.quit();
          },
        },
      ],
    });
    const windowMenu = template.find(function (m) {
      return m.role === "window";
    });
    if (windowMenu) {
      windowMenu.submenu.push(
        {
          type: "separator",
        },
        {
          label: "Bring All to Front",
          role: "front",
        }
      );
    }
  }

  return template;
}
