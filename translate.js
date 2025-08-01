const axios = require('axios');

 axios.post("https://ru.libretranslate.com/translate", {
		q: "Привет",
		source: "auto",
		target: "ru",
		format: "text",
		alternatives: 3,
		api_key: ""
},{
  headers: { "Content-Type": "application/json" }
}).then(res => {
  console.log(res.data);
})



// test
// Идентификатор M0EE2FT5N06U2DOHUO8A2QQOOH
// Секрет ukNvx6pAX0rr9irhyy51lMdRbeLyd4r8Q48xChqG4yE