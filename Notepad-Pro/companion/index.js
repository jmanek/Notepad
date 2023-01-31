import { settingsStorage } from "settings";
import * as messaging from "messaging";
import { me } from "companion";
import { localStorage } from "local-storage";
import { inbox, outbox } from "file-transfer";
import cbor from 'cbor'

const API_ENDPOINT = 'https://jewstore.firebaseio.com/NotepadPro/users/';
let checking_license = false;

async function processAllFiles() {
   let file;
   while ((file = await inbox.pop())) {
     let payload = await file.cbor();
     console.log('New license received from device')
     if (payload.license === 'trial' && settingsStorage.getItem('license') !== 'paid') {
       //create new customer in db
       console.log(JSON.stringify(payload))
       fetch(API_ENDPOINT + '.json', {
         method: 'PATCH',
         body: JSON.stringify({[payload.userid]: payload})
       })
       .then(() => {
         settingsStorage.setItem('license', payload.license)
         settingsStorage.setItem('trial_end_date', payload.trial_end_date)
         settingsStorage.setItem('trial_start_date', payload.trial_start_date)
         settingsStorage.setItem('userid', payload.userid)
         checkLicense()
       })
       .catch(err => {console.log('Error creating new user'); console.log(err)})

     } else {
       console.log('Ignored license received from device')
       console.log(JSON.stringify(payload))
       sendLicense()
     }
   }
}

function sendLicense() {
  if (!settingsStorage.getItem('license')) return;
  const license = {
         license: settingsStorage.getItem('license'),
         trial_end_date: settingsStorage.getItem('trial_end_date'),
         trial_start_date: settingsStorage.getItem('trial_start_date'),
         userid: settingsStorage.getItem('userid')
  }
  outbox.enqueue('license2.cbor', cbor.encode(license))
  .then(ft => console.log('License file queued to device'))
  .catch(error => console.log('Failed to queue license file to device' +  error))  
}


function checkLicense() {
  function _checkLicense() {
    setTimeout(() => {
      if (settingsStorage.getItem('license') === 'paid') return;
      fetch(API_ENDPOINT + settingsStorage.getItem('userid') + '.json')
        .then(async res => {
          res = await res.json()
          if (res && res.license === 'paid') {
            settingsStorage.setItem('license', 'paid')
            sendLicense()
            checking_license = false;
          } else {
            _checkLicense()
          }
        })
        // .catch(err => {console.log('Error downloading user'); console.log(err)})
    }, 1000)    
  }
  
  if (checking_license) return;
  checking_license = true;
  _checkLicense()
}


function sendSettings(evt) {
  outbox.enqueue('settings.cbor', cbor.encode(evt))
  
}

settingsStorage.addEventListener('change', evt => {
  sendValue(evt.key, evt.newValue);
  if (evt.key === 'license') sendLicense()
})


function sendValue(key, val) {
  if (val) {
    try {
      val = JSON.parse(val)
    } catch(err) {}
    sendSettingData({
      key: key,
      value: val
    }, key !== 'clear_canvas_timeout');
  }
}

function sendSettingData(data, upload) {
  // If we have a MessageSocket, send the data to the device
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    messaging.peerSocket.send(data);
  } else {
    console.log("No peerSocket connection to device");
  }
  if (upload) {
      outbox.enqueue('settings.cbor', cbor.encode(data))
    .then(ft => console.log('Settings file queued to device'))
    .catch(error => console.log('Failed to queue Settings file to device' +  error))
  }
    
}



//
//

inbox.addEventListener("newfile", processAllFiles);
processAllFiles()
sendLicense()
if (settingsStorage.getItem('license') === 'trial') checkLicense()
