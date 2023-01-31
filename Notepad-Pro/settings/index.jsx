const API_ENDPOINT = 'https://jewstore.firebaseio.com/NotepadPro/users/';
const CHECKOUT_ENDPOINT = 'https://fitbit.shamir.store';


function downloadLicense(props) {
  const userid = props.settings.userid;
  return () => {
      fetch(API_ENDPOINT + userid + '.json')
      .then(async res => {
        res = await res.json()
        if (res.license === 'paid') props.settingsStorage.setItem('license', 'paid')
      })
      .catch(err => {console.log('Error downloading user ' + userid.toString()); console.log(err)})
  }
}

function getTrialStatus(trial_end_date) {
  let trial_remaining = trial_end_date - new Date().getTime();
  if (trial_remaining > 0) return 'Trial ends in ' + getFuzzyDuration(trial_remaining)
  else return "Trial over"
}


function getFuzzyDuration(trial_remaining) {
  //get duration in minutes, rounded up
  let durationInMinutes = Math.ceil(trial_remaining / 60000.0);
  let numberOfHours = Math.floor(durationInMinutes / 60);
  let numberOfMinutes = durationInMinutes - (numberOfHours * 60);

  let fuzzyDuration = "";
  if (numberOfHours > 0) {
    fuzzyDuration = numberOfHours + " hrs, ";
  }
  return fuzzyDuration + numberOfMinutes + " min.";
}


function Settings(props) {
  return (
    <Page>
      {props.settings.license !== 'paid' &&
      <Section
        title={<Text bold align="center">License</Text>}>
        <Text>{getTrialStatus(props.settings.trial_end_date)}</Text>
          <Text>Click the link below to purchase Notepad Pro</Text>
        <Link id="checkout-link" source={`${CHECKOUT_ENDPOINT}?userid=${props.settings.userid}`}>Complete Purchase</Link>
        <Text>Then click this button to verify your purchase</Text>
          <Button
          label="Download License"
          onClick={downloadLicense(props)}/>
      </Section> 
      }
      {props.settings.license === 'paid' &&
      <Section
        title={<Text bold align="center">License</Text>}>
        <Text>Paid</Text>
      </Section>      
      }

      <Section
        title={<Text bold align="center"></Text>}>
        <Button
          label="Delete all notes"
          onClick={() => props.settingsStorage.setItem('delete_all_notes', '1')}
        />
      </Section>
      <Section
        title={<Text bold align="center">Auto-Save Delay (milliseconds)</Text>}>
        <Slider
          label={props.settingsStorage.getItem('clear_canvas_timeout')}
          settingsKey="clear_canvas_timeout"
          min="100"
          max="1000"
        />
      
      </Section>
      <Section
        title={<Text bold align="center">Left-handed Mode</Text>}>
       <Toggle
          settingsKey="left_handed_mode"
        />
      </Section>  
      <Section
        title={<Text bold align="center">Line Color</Text>}>
        <ColorSelect
          settingsKey="stroke_color"
          colors={[
            {color: 'aliceblue'},
            {color: 'antiquewhite'},
            {color: 'aqua'},
            {color: 'aquamarine'},
            {color: 'azure'},
            {color: 'beige'},
            {color: 'bisque'},
            {color: 'blanchedalmond'},
            {color: 'blue'},
            {color: 'blueviolet'},
            {color: 'burlywood'},
            {color: 'cadetblue'},
            {color: 'chartreuse'},
            {color: 'chocolate'},
            {color: 'coral'},
            {color: 'cornflowerblue'},
            {color: 'cornsilk'},
            {color: 'crimson'},
            {color: 'cyan'},
            {color: 'darkviolet'},
            {color: 'deeppink'},
            {color: 'deepskyblue'},
            {color: 'dimgray'},
            {color: 'dimgrey'},
            {color: 'dodgerblue'},
            {color: 'firebrick'},
            {color: 'floralwhite'},
            {color: 'forestgreen'},
            {color: 'fuchsia'},
            {color: 'gainsboro'},
            {color: 'ghostwhite'},
            {color: 'gold'},
            {color: 'goldenrod'},
            {color: 'green'},
            {color: 'greenyellow'},
            {color: 'grey'},
            {color: 'honeydew'},
            {color: 'hotpink'},
            {color: 'indianred'},
            {color: 'indigo'},
            {color: 'ivory'},
            {color: 'khaki'},
            {color: 'lavender'},
            {color: 'lavenderblush'},
            {color: 'lawngreen'},
            {color: 'lemonchiffon'},
            {color: 'lightblue'},
            {color: 'lightcoral'},
            {color: 'lightcyan'},
            {color: 'lightgoldenrodyellow'},
            {color: 'lightgray'},
            {color: 'lightgreen'},
            {color: 'lightgrey'},
            {color: 'lightpink'},
            {color: 'lightsalmon'},
            {color: 'lightseagreen'},
            {color: 'lightskyblue'},
            {color: 'lightsteelblue'},
            {color: 'lightyellow'},
            {color: 'lime'},
            {color: 'limegreen'},
            {color: 'linen'},
            {color: 'magenta'},
            {color: 'maroon'},
            {color: 'midnightblue'},
            {color: 'mintcream'},
            {color: 'mistyrose'},
            {color: 'moccasin'},
            {color: 'navajowhite'},
            {color: 'navy'},
            {color: 'oldlace'},
            {color: 'olive'},
            {color: 'olivedrab'},
            {color: 'orange'},
            {color: 'orangered'},
            {color: 'orchid'},
            {color: 'palegoldenrod'},
            {color: 'palegreen'},
            {color: 'paleturquoise'},
            {color: 'palevioletred'},
            {color: 'papayawhip'},
            {color: 'peachpuff'},
            {color: 'peru'},
            {color: 'pink'},
            {color: 'plum'},
            {color: 'powderblue'},
            {color: 'purple'},
            {color: 'red'},
            {color: 'rosybrown'},
            {color: 'royalblue'},
            {color: 'saddlebrown'},
            {color: 'salmon'},
            {color: 'sandybrown'},
            {color: 'seagreen'},
            {color: 'seashell'},
            {color: 'sienna'},
            {color: 'silver'},
            {color: 'skyblue'},
            {color: 'slateblue'},
            {color: 'slategray'},
            {color: 'slategrey'},
            {color: 'snow'},
            {color: 'springgreen'},
            {color: 'steelblue'},
            {color: 'tan'},
            {color: 'teal'},
            {color: 'thistle'},
            {color: 'tomato'},
            {color: 'turquoise'},
            {color: 'violet'},
            {color: 'wheat'},
            {color: 'white'},
            {color: 'whitesmoke'},
            {color: 'yellow'},
            {color: 'yellowgreen'}
          ]}
        />
      </Section>
    </Page>
  );
}


registerSettingsPage(Settings);