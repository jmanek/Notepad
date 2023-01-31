import { vibration } from "haptics";
import document from "document";
import { me as device } from "device";
import fs from "fs";
import { settingsStorage } from "settings";
import * as messaging from "messaging"; 
import { outbox, inbox } from "file-transfer";
import cbor from "cbor";


// Rects
const canvas = document.getElementById("canvas");
const viewerCanvas = document.getElementById("viewerCanvas");
const trialStatus = document.getElementById("trialStatus");

// Buttons
const viewerButton = document.getElementById("viewerButton");
const deletePointsButton = document.getElementById("deletePointsButton");
// Text
const savedLinesCountText = document.getElementById("savedLinesCount");

// Images
const openViewerImage = document.getElementById("openViewer");
const openCanvasImage = document.getElementById("openCanvas");
const autoClearImage = document.getElementById("autoClear");
const manualClearImage = document.getElementById("manualClear");
const saveCanvasImage = document.getElementById("saveCanvas");
const clearCanvasImage = document.getElementById("clearCanvas");
const deleteSavedImage = document.getElementById("deleteSaved");
// Lines
let strokeGuideLinesLeft = document.getElementsByClassName("strokeGuidesLeft");
let strokeGuideLinesRight = document.getElementsByClassName("strokeGuidesRight");
const lines = document.getElementsByClassName("strokeLines");


const device_width = device.screen.width;
const device_height = device.screen.height;

const PRO_VERSION = false;
const LINES_FILENAME = 'lines.bin'
const SETTINGS_FILENAME = "settings.cbor";
const LICENSE_FILENAME = "settings.cbor";
const CONSOLE_LOGGING = true;
const LINES_META_BYTE_COUNT = PRO_VERSION ? 4 : 2;
const TRIAL_LENGTH = 86400000;


// Settings
let settings = {};
let STROKE_COLOR = 'white'
let CLEAR_CANVAS_TIMEOUT = 370
let WATCH_WRIST = 'Left'

let line_index = 0;
let num_active_lines = 0;

let skipped_last_point = false;
const last_point = new Uint16Array(2)

let saved_lines_index = 0;
let lines_file_byte_offsets = [];

let lines_file = null;

let canvas_save_type = 'auto';


//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\
// UI
//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\


function drawLine(x1, y1, x2, y2) {
  if (line_index >= lines.length) line_index = 0;
  const line = lines[line_index];
  line.x1 = x1;
  line.y1 = y1;
  line.x2 = x2;
  line.y2 = y2;
  if (line.style.display === 'none') num_active_lines++;
  line.style.display = 'inherit'
  line.style.fill = STROKE_COLOR
  line.style.strokeWidth = 2
  line_index++;
}


function addPoint(x, y, draw=true) {
  if (last_point[0] && draw) {
    const distance = (x - last_point[0]) ** 2 + (y - last_point[1]) ** 2
    if ((distance > 2 && distance < 10000) || skipped_last_point) {
      drawLine(last_point[0], last_point[1], x, y);
      skipped_last_point = false;
    } else skipped_last_point = true;
  } else if (!draw) {
    skipped_last_point = true;
  }
  last_point[0] = x;
  last_point[1] = y;
}

function setWrist(wrist) {
  if (wrist === 'Right') {
    document.getElementById('viewerButton').x = device_width - 50;
    document.getElementById('deletePointsButton').x = 0;
    savedLinesCountText.x = 100;
    if (canvas.style.display !== 'none') {
      strokeGuideLinesLeft.forEach(strokeGuide => strokeGuide.style.display = 'none')
      strokeGuideLinesRight.forEach(strokeGuide => strokeGuide.style.display = 'inherit')      
    }
  } else {
    document.getElementById('viewerButton').x = 0;
    document.getElementById('deletePointsButton').x = device_width - 50;
    savedLinesCountText.x = device_width - 50;
    if (canvas.style.display !== 'none') {
      strokeGuideLinesLeft.forEach(strokeGuide => strokeGuide.style.display = 'inherit')
      strokeGuideLinesRight.forEach(strokeGuide => strokeGuide.style.display = 'none')
    }
  }
  WATCH_WRIST = wrist;
}

function clearDisplay() {
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx].style.display === "none") break;
    lines[idx].style.display = "none"
  }
  line_index = 0;
  num_active_lines = 0
  last_point[0] = 0
  last_point[1] = 0
}


function clearCanvas() {
  if (num_active_lines) writeLines();
  clearDisplay()
}



function clearCanvasOnInactivity() {
  const curr_line_index = line_index;
  setTimeout(() => {
    if (curr_line_index === line_index) {
      if (canvas_save_type !== 'manual') {
        clearCanvas();
        vibration.start("bump");
      }
    } 
  }, CLEAR_CANVAS_TIMEOUT)
}


function updateSavedLinesCountText() {
  savedLinesCountText.text = (lines_file_byte_offsets.length? saved_lines_index + 1: 0).toString() +
                             '/' + (lines_file_byte_offsets.length).toString();
}

function showSavedLines() {
  if (saved_lines_index >= lines_file_byte_offsets.length) saved_lines_index = 0;
  else if (saved_lines_index < 0) saved_lines_index = lines_file_byte_offsets.length - 1;
  updateSavedLinesCountText()
  loadLines(lines_file_byte_offsets[saved_lines_index])
}


function showNextSavedLines() {
  if (!lines_file_byte_offsets.length) return;
  saved_lines_index++;
  showSavedLines()
}


function showPrevSavedLines() {
  if (!lines_file_byte_offsets.length) return;
  saved_lines_index--;
  showSavedLines()
}


function toggleGuideLines() {
  if (WATCH_WRIST === 'Left') {
    strokeGuideLinesLeft.forEach(strokeGuide => 
                           strokeGuide.style.display = strokeGuide.style.display === 'none' ? 'inherit' : 'none')
  } else {
    strokeGuideLinesRight.forEach(strokeGuide => 
                         strokeGuide.style.display = strokeGuide.style.display === 'none' ? 'inherit' : 'none')
  }
}


function showGuideLines() {
  if (WATCH_WRIST === 'Left') strokeGuideLinesLeft.forEach(strokeGuide => {setDisplayProp(strokeGuide, 'inherit')})
  else strokeGuideLinesRight.forEach(strokeGuide => {setDisplayProp(strokeGuide, 'inherit')})
}


function hideGuideLines() {
  if (WATCH_WRIST === 'Left') strokeGuideLinesLeft.forEach(strokeGuide => {setDisplayProp(strokeGuide, 'none')})
  else strokeGuideLinesRight.forEach(strokeGuide => {setDisplayProp(strokeGuide, 'none')})
}


function setDisplayProp(ele, val) {
  ele.style.display = val;
}


function showCanvasSaveControls() {
  if (canvas_save_type === 'manual') {
    setDisplayProp(autoClearImage, 'none');
    setDisplayProp(manualClearImage, 'inherit');
  } else {
    setDisplayProp(autoClearImage, 'inherit');
    setDisplayProp(manualClearImage, 'none');
  } 
}


function hideCanvasSaveControls() {
  setDisplayProp(autoClearImage, 'none');
  setDisplayProp(manualClearImage, 'none');
}


function showManualSaveControls() {
  hideCanvasSaveControls()
  setDisplayProp(openViewerImage, 'none');
  setDisplayProp(saveCanvasImage, 'inherit');
  setDisplayProp(clearCanvasImage, 'inherit');
}


function hideManualSaveControls() {
  setDisplayProp(saveCanvasImage, 'none');
  setDisplayProp(clearCanvasImage, 'none');
  showCanvasSaveControls()
  setDisplayProp(openViewerImage, 'inherit');
}


function openCanvas() {
  setDisplayProp(canvas, 'inherit');
  setDisplayProp(viewerCanvas, 'none');

  setDisplayProp(openViewerImage, 'inherit');
  setDisplayProp(openCanvasImage, 'none');
  
  setDisplayProp(deleteSavedImage, 'none');
  setDisplayProp(savedLinesCountText, 'none');
  setDisplayProp(trialStatus, 'none');

  showCanvasSaveControls()
  showGuideLines();
}

function openViewer() {
  setDisplayProp(canvas, 'none');
  setDisplayProp(viewerCanvas, 'inherit');

  setDisplayProp(openViewerImage, 'none');
  setDisplayProp(openCanvasImage, 'inherit');
  hideCanvasSaveControls()
  setDisplayProp(saveCanvasImage, 'none');
  setDisplayProp(clearCanvasImage, 'none');
  
  setDisplayProp(deleteSavedImage, 'inherit');
  setDisplayProp(savedLinesCountText, 'inherit');
  setDisplayProp(trialStatus, 'none');

  hideGuideLines();
}

function openTrialStatus() {
  setDisplayProp(trialStatus, 'inherit');
  setDisplayProp(viewerButton, 'none');
  setDisplayProp(deletePointsButton, 'none');
}



//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\
// IO
//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\


function getLinesFileSize() {
  return fs.statSync('/private/data/' + LINES_FILENAME).size
}


function openLinesFile() {
  if (lines_file) fs.closeSync(lines_file)
  // Forces the file to be created it if doesn't exist
  lines_file = fs.openSync(LINES_FILENAME, 'a')
  fs.closeSync(lines_file)
  lines_file = fs.openSync(LINES_FILENAME, 'r+')
}


function deleteLinesFile() {
  fs.closeSync(lines_file)
  fs.unlinkSync('/private/data/' + LINES_FILENAME)
  openLinesFile()
}


function flushLinesFile() {
  fs.closeSync(lines_file)
  openLinesFile()
}


function getSavedLinesByteOffsets() {
  flushLinesFile()
  lines_file_byte_offsets = []

  let position = 0;
  while (true) {
    let buffer = new ArrayBuffer(LINES_META_BYTE_COUNT);
    fs.readSync(lines_file, buffer, 0, LINES_META_BYTE_COUNT, position);
    const num_lines_bytes = new Uint16Array(buffer)
    if (PRO_VERSION) {
      if (num_lines_bytes[0] && num_lines_bytes[1]) {
        lines_file_byte_offsets.push(position)
      } else if (!num_lines_bytes[0]) {
        break
      }      
    } else {
      if (num_lines_bytes[0]) {
        lines_file_byte_offsets.push(position)
      } else {
        break
      }     
    }
    position += LINES_META_BYTE_COUNT + num_lines_bytes[0]
  }
}


function loadLines(position = 0) {
  let buffer = new ArrayBuffer(LINES_META_BYTE_COUNT);
  fs.readSync(lines_file, buffer, 0, LINES_META_BYTE_COUNT, position);
  let num_lines_bytes = (new Uint16Array(buffer))[0];
  if (getLinesFileSize() < num_lines_bytes + position) {
    print('Trying to load more bytes than saved');
    deleteLinesFile()
    return
  } 
  print('Loading ' + num_lines_bytes.toString() + ' bytes from ' + position.toString())
  let lines_buffer = new ArrayBuffer(num_lines_bytes);
  fs.readSync(lines_file, lines_buffer, 0, num_lines_bytes, position + LINES_META_BYTE_COUNT);
  const new_lines = new Uint16Array(lines_buffer);
  clearDisplay()
  let idx = new_lines.length;
  while (idx) {
    drawLine(new_lines[idx - 4], new_lines[idx - 3], new_lines[idx - 2], new_lines[idx - 1]);
    idx -= 4;
  }
}


function writeLines() {
  if (!num_active_lines) return;
  print('Writing ' + num_active_lines.toString() + ' lines')
  
  const lines_data = new Uint16Array(num_active_lines * 4);
  let line_idx = num_active_lines;
  let line_idx_m = num_active_lines * 4;
  let line = null;
  while (line_idx) {
    line = lines[line_idx - 1];
    lines_data[line_idx_m - 4] = line.x1;
    lines_data[line_idx_m - 3] = line.y1;
    lines_data[line_idx_m - 2] = line.x2;
    lines_data[line_idx_m - 1] = line.y2;
    line_idx--;
    line_idx_m -= 4;
  }
  
  const lines_file_size = getLinesFileSize();
  const lines_meta = PRO_VERSION ? new Uint16Array([lines_data.byteLength, 1]) : new Uint16Array([lines_data.byteLength]);
  fs.writeSync(lines_file, lines_meta, 0, LINES_META_BYTE_COUNT, lines_file_size)
  fs.writeSync(lines_file, lines_data, 0, lines_data.byteLength, lines_file_size + LINES_META_BYTE_COUNT);
}

function deleteSavedLines() {
  if (saved_lines_index >= 0 && saved_lines_index < lines_file_byte_offsets.length) {
    const position = lines_file_byte_offsets[saved_lines_index];
    fs.writeSync(lines_file, new Uint16Array([0]), 0, 2, position + 2);
    lines_file_byte_offsets.splice(saved_lines_index, 1);
    if (!lines_file_byte_offsets.length) {
      saved_lines_index = 0;
      updateSavedLinesCountText()
      deleteLinesFile()
    } else {
      showPrevSavedLines();
    }
  }
}

function loadSettings() {
  if (!PRO_VERSION) return;
  try {
    settings = fs.readFileSync(SETTINGS_FILENAME, 'cbor');
  } catch (ex) {
    settings = {};
  }
  if (settings.stroke_color) STROKE_COLOR = settings.stroke_color
  if (settings.clear_canvas_timeout) CLEAR_CANVAS_TIMEOUT = settings.clear_canvas_timeout
  setWrist(settings.left_handed_mode ? 'Right' : 'Left')
}

function saveSettings() {
  fs.writeFileSync(SETTINGS_FILENAME, settings, 'cbor');
}

function createLicense() {
  print('Creating license file')
  const curr_date = (new Date()).getTime();
  const userid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  const license = {
    license: 'trial',
    trial_start_date: curr_date,
    trial_end_date: curr_date + TRIAL_LENGTH,
    userid: userid
  }
  print(JSON.stringify(license))

  outbox.enqueue('license.cbor', cbor.encode(license))
  .then(ft => {
   print('License file queued to companion');
   fs.writeFileSync(LICENSE_FILENAME, license, 'cbor')
  })
  .catch(error => {
   print('Failed to queue license file to companion' +  JSON.stringify(error));
  })
  
  return license
}

function checkLicense() {
  let license;
  if (!fs.existsSync(LICENSE_FILENAME)) {
    license = createLicense();
  } else {
    license = fs.readFileSync(LICENSE_FILENAME, 'cbor')
    if (license.license === 'trial') {
      const curr_date = (new Date()).getTime();
      if (curr_date > license.trial_end_date || !license.trial_end_date) {
        //display payment screen
        //require connection to phone
        print('Trial Expired')
        openTrialStatus()
      } else {
        print(((license.trial_end_date - curr_date)/60000).toString() + ' minutes remaining in trial')
      }
    } else if (license.license === 'paid') {
      //purchase complete
      print('License Purchased')
    } else {
      createLicense();
    }
  }
  settings.license = license.license;
  settings.userid = license.userid;
  settings.trial_end_date = license.trial_end_date;
  settings.trial_start_date = license.trial_start_date;
  if (settings.license === 'paid') {
    setDisplayProp(viewerButton, 'inherit');
    setDisplayProp(deletePointsButton, 'inherit');
    openCanvas();
    openCanvas();
    
  }    
  return license
  
}

function updateLicense(prop) {
  let license;
  print(JSON.stringify(prop))
  if (!fs.existsSync(LICENSE_FILENAME)) {
    if (prop.license === 'paid') {
      print('License doesnt exist locally but app has been paid for')
    } 
    license = prop;
  } else {
    license = {...fs.readFileSync(LICENSE_FILENAME, 'cbor'), ...prop}
  }
  fs.writeFileSync(LICENSE_FILENAME, license, 'cbor')
  checkLicense();
}

function updateSettings(data) {
    if (data.key === 'delete_all_notes') {
      deleteLinesFile();
      if (canvas.style.display === "none") {
        clearDisplay();
        getSavedLinesByteOffsets()
        updateSavedLinesCountText()
      }
      return
    }
    if (data.key === 'stroke_color') STROKE_COLOR = data.value
    if (data.key === 'clear_canvas_timeout') CLEAR_CANVAS_TIMEOUT = data.value
    if (data.key === 'left_handed_mode') setWrist(data.value ? 'Right' : 'Left')
    if (data.key === 'license') updateLicense({[data.key]: data.value})
    if (data.key === 'userid') updateLicense({[data.key]: data.value})
    settings[data.key] = data.value
    saveSettings()
  }


//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\
// Events
//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\


canvas.onmousedown = evt => addPoint(evt.screenX, evt.screenY, false);


canvas.onclick = evt => addPoint(evt.screenX, evt.screenY, false);


canvas.onmousemove = evt => {
  // TODO: Check if you've already opened the controls?
  if (!num_active_lines && canvas_save_type === 'manual') showManualSaveControls()
  addPoint(evt.screenX, evt.screenY)
  clearCanvasOnInactivity();
}


viewerButton.onactivate = evt => {
  if (canvas.style.display === "none") {
    clearDisplay();
    openCanvas();
    flushLinesFile();
  } else {
    if (canvas_save_type === 'manual' && last_point[0]) {
      clearCanvas();
      vibration.start("bump");
      hideManualSaveControls();
    } else {
      openViewer();
      getSavedLinesByteOffsets();
      saved_lines_index = 0;
      updateSavedLinesCountText()
      showPrevSavedLines();      
    }
  }
}


deletePointsButton.onactivate = evt => {
  if (canvas.style.display === "none") {
    clearDisplay();
    if (PRO_VERSION) {
      deleteSavedLines();
    } else {
      deleteLinesFile();
      lines_file_byte_offsets = []
      saved_lines_index = 0
      updateSavedLinesCountText()
    }
  } else {
    if (canvas_save_type === 'manual') {
      if (last_point[0]) clearDisplay();
      else canvas_save_type = 'auto';
      hideManualSaveControls();
    } else {
      canvas_save_type = 'manual';
      showCanvasSaveControls();
    }
  }
}
      

viewerCanvas.onactivate = evt => {
  if (evt.screenX < device_width / 2) showPrevSavedLines();
  else showNextSavedLines();
}


messaging.peerSocket.addEventListener('message', evt => {
  if(!PRO_VERSION) return;
  else if (evt.data && evt.data.key) updateSettings(evt.data)
})


inbox.addEventListener("newfile", () => {
  // print('New file received from companion')
  let filename;
  while (filename = inbox.nextFile()) {
    const payload = fs.readFileSync(filename, 'cbor')
    if (!payload) {
      print('Unknown file recieved in inbox')
      print(payload)
      return
    }
    if (payload.key && payload.value) updateSettings(payload)
    else updateLicense(payload)
  }
})
                       

//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\
// Test
//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\


function print(msg) {
  if (!CONSOLE_LOGGING) return;
   console.log(msg)
}


function generateTestLines(idx=0, maxIdx=300, numLines=4, timeOut=100) {
  if (idx === maxIdx) return;
  setTimeout(() => {
      for (let i = 0; i < numLines; i++) {
        const x1 = Math.floor(Math.random() * device_width)
        const y1 = Math.floor(Math.random() * device_height)
        const x2 = Math.floor(Math.random() * device_width)
        const y2 = Math.floor(Math.random() * device_height)
        drawLine(x1, y1, x2, y2);
      }
      writeLines()
      clearDisplay()
      generateTestLines(idx + 1, maxIdx, numLines, timeOut)
  }, timeOut);
}


function test() {
  deleteLinesFile()
  generateTestLines(0, 300, 1, 20)
}


//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\
// Main
//\\//\\//\\//\\//\\//\\//\\//\\//\\//
////\\//\\//\\//\\//\\//\\//\\//\\//\\

// test()
openCanvas();
openCanvas();
if (PRO_VERSION) {
  loadSettings();
  checkLicense();
}

openLinesFile();

