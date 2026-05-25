const https = require('https');
https.get('https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3', (res) => {
  console.log(res.statusCode);
  console.log(res.headers['content-type']);
});
