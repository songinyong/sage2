//
// SAGE2 application: welcome
// by: Luc Renambot <renambot@gmail.com>
//
// Copyright (c) 2015
//

var welcome = SAGE2_App.extend({
	init: function(data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the background to black
		this.element.style.backgroundColor = 'black';

		// Make the SVG element fill the app
		this.svg = Snap("100%", "100%");
		// Adding it to the DOM
		this.element.appendChild(this.svg.node);
		// Sets the scale of the SVG scenegraph: 0 to 100 (make sure it matches aspect ratio from pacakge.json)
		var ratio = 100 * data.height / data.width;
		this.svg.attr("viewBox", "0,0,100," + ratio);
		// Lets create a background
		var rectbg = this.svg.rect(0, 0, 100, 100);
		// lets change its attributes
		rectbg.attr({ fill: "#000000", strokeWidth: 0 });
		// create image: src, x,y, width,height
		// adds the application icon
		this.image = this.svg.image(smallTansparentGIF(), 0, 0, 100, ratio);

		// Time
		this.textDate  = this.makeText(50,  6,  "6px", " ", 1);
		this.textTime  = this.makeText(50, 25, "16px", " ", 1);
		this.textGreet = this.makeText(50, 35,  "8px", " ", 1);
		this.updateTime(data.date);

		this.textQuote = this.makeText(50, 60, "2px", "  ", 2);
		this.textLocation = this.makeText(2, 64, "1.2px", "  ", 2);
		this.textLocation.attr({textAnchor: 'start'});
		this.textAttribution = this.makeText(97, 64, "1.2px", "  ", 2);
		this.textAttribution.attr({textAnchor: 'end'});
		this.textWeather = this.makeText(98, 11, "4px", "  ", 3);
		this.textWeather.attr({textAnchor: 'end'});
		this.textGeolocation = this.makeText(98, 14, "2px", "  ", 3);
		this.textGeolocation.attr({textAnchor: 'end'});

		this.iconWeather = this.svg.image(smallTansparentGIF(), 90, 0, 10, 10);

		// last request
		this.lastRequest = -10000;

		// resize callback
		this.resizeEvents = "onfinish";

		// SAGE2 Application Settings
		//
		// Control the frame rate for an animation application
		this.maxFPS = 1.0 / 60.0;

		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;

		// request it fullscreen
		if (this.state.goFullscreen) {
			this.sendFullscreen();
			// only go fullscreen at creation time, not reload nor session
			this.state.goFullscreen = false;
			// Manual sync of the state since changed outside event handler
			this.SAGE2Sync();
		}
	},

	requestPicture: function() {
		// Get a new image every 15min
		if (isMaster && ((this.t - this.lastRequest) > 900)) {
			// Generate a new random ID
			var aUrl = 'https://www.gstatic.com/prettyearth/assets/data/v3/' + this.state.imageID + '.json';
			this.applicationRPC({image: true, url: aUrl}, "gotPicture", true);
			// update the time
			this.lastRequest = this.t;
			// setup for next image
			this.state.imageID = this.getNewImageID();
		}
	},

	makeText: function(x, y, fs, value, stroke, col) {
		var text = this.svg.text(x, y, value);
		text.attr({textAnchor: 'middle', "font-size": fs});
		if (col) {
			text.attr({fill: col});
		} else {
			text.attr({fill: "#FFFFFF"});
		}
		text.attr({fontFamily: 'Helvetica,Arial,sans-serif'});
		if (stroke === 1) {
			text.attr({paintOrder: 'stroke', stroke: '#000000'});
			text.attr({strokeWidth: '0.15px', strokeLinecap: 'butt', strokeLinejoin: 'miter'});
		} else if (stroke === 2) {
			text.attr({fontFamily: 'Helvetica,Arial,sans-serif'});
		}
		return text;
	},

	gotWeather: function(data) {
		var weather = data.weather;
		var text = Math.round(weather.main.temp) + 'F';
		this.textWeather.attr({text: text});
		this.iconWeather.attr("xlink:href", "http://openweathermap.org/img/w/"
			+ weather.weather[0].icon + ".png");
	},

	gotLocation: function(data) {
		// SAGE2 location
		// "ip": "131.193.78.133",
		// "hostname": "No Hostname",
		// "city": "Chicago",
		// "region": "Illinois",
		// "country": "US",
		// "loc": "41.8784,-87.6852",
		// "org": "AS6200 University of Illinois at Chicago",
		// "postal": "60612"
		var geojson = data.location;
		if (geojson && geojson.city) {
			this.textGeolocation.attr({text: geojson.city.toUpperCase()});
			if (isMaster) {
				// Now get the weather
				var loc = geojson.city;
				if (geojson.country) {
					loc += "," + geojson.country;
				}
				this.applicationRPC({weather: true, place: loc}, "gotWeather", true);
			}
		}
	},

	gotPicture: function(data) {
		if (data.err && data.err !== null) {
			console.log('Welcome> error');
			return;
		}
		// Set the picture URL
		this.image.attr("xlink:href", data.picture.dataUri);
		// Update the quote text
		this.textQuote.attr({text: "\"" + data.quote + "\""});

		// Location of picture
		var locationText;
		var location = data.picture.geocode;
		if (location) {
			locationText = location.locality || "";
			if (location.administrative_area_level_1) {
				if (locationText.length > 0) {
					locationText += ", " + location.administrative_area_level_1;
				} else {
					locationText = location.administrative_area_level_1;
				}
			}
			if (location.country) {
				if (locationText.length > 0) {
					locationText += ", " + location.country;
				} else {
					locationText += location.country;
				}
			}
		} else {
			let region = data.picture.region || "";
			let country = data.picture.country || "";
			locationText = region + ", " + country;
		}
		this.textLocation.attr({text: locationText});
		this.textAttribution.attr({text: data.picture.attribution});

		if (isMaster) {
			// now get the location of the wall
			this.applicationRPC({location: true}, "gotLocation", true);
		}
	},

	load: function(date) {
		this.refresh(date);
	},

	updateTime: function(date) {
		var now = moment(date);
		this.textDate.attr({text: now.format('LL')});
		this.textTime.attr({text: now.format('h:mm')});
		var greetString;
		var h = now.hours();
		if (h >= 19) {
			greetString = "Good evening";
		} else if (h >= 12) {
			greetString = "Good afternoon";
		} else if (h >= 6) {
			greetString = "Good morning";
		} else {
			greetString = "Good night";
		}
		this.textGreet.attr({text: greetString});
	},

	draw: function(date) {
		this.requestPicture();
		this.updateTime(date);
	},

	resize: function(date) {
		this.svg.attr('width',  this.element.clientWidth  + "px");
		this.svg.attr('height', this.element.clientHeight + "px");
		this.refresh(date);
	},

	quit: function() {
		// Make sure to delete stuff (timers, ...)
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// Pointer press
		} else if (eventType === "pointerMove" && this.dragging) {
			// Pointer move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// Pointer release
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
		} else if (eventType === "widgetEvent") {
			// Widget events
		} else if (eventType === "keyboard") {
			if (data.character === "m") {
				this.refresh(date);
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") { // left
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") { // up
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") { // right
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") { // down
				this.refresh(date);
			}
		}
	},

	getNewImageID: function() {
		var imageIds = [
			"11935", "11932", "13942", "13735", "13730", "13419", "12078", "14752",
			"14737", "14727", "14719", "14718", "14669", "14661", "14647", "14642",
			"14632", "14623", "14613", "14612", "14603", "14602", "14599", "14569",
			"14560", "14549", "14542", "14517", "14508", "14498", "14489", "14484",
			"14478", "14456", "14434", "14313", "14312", "14246", "14111", "14108",
			"14097", "14086", "14068", "14066", "14059", "14048", "14046", "14004",
			"13986", "13980", "13925", "13868", "13763", "13758", "13678", "13645",
			"13581", "13222", "13208", "13201", "12986", "12878", "12861", "12801",
			"12686", "12657", "12623", "14197", "14196", "14190", "14188", "14181",
			"14171", "14168", "14145", "14793", "14792", "14791", "14790", "14788",
			"14787", "14786", "14784", "14783", "14782", "14781", "11566", "13192",
			"12277", "12198", "11573", "14765", "14700", "14646", "14523", "14506",
			"14504", "14497", "14451", "14446", "14436", "14429", "14362", "14354",
			"14344", "14340", "14339", "14332", "14309", "14256", "14254", "14126",
			"14124", "14107", "14105", "14099", "14096", "14091", "14090", "14085",
			"14084", "14083", "14074", "14073", "14072", "14067", "14060", "14047",
			"14015", "14011", "14007", "14006", "14005", "13991", "13984", "13974",
			"13973", "13967", "13933", "13932", "13924", "13911", "13907", "13906",
			"13897", "13887", "13886", "13885", "13871", "13860", "13859", "13853",
			"13841", "13839", "13830", "13826", "13824", "13818", "13788", "13773",
			"13770", "13769", "13765", "13747", "13745", "13731", "13687", "13661",
			"13660", "13649", "13646", "13643", "13640", "13633", "13631", "13598",
			"13591", "13580", "13547", "13520", "13519", "13485", "13467", "13439",
			"13414", "13400", "13394", "13389", "13288", "13281", "13280", "13261",
			"13249", "13245", "13238", "13212", "13209", "13202", "13200", "13158",
			"13151", "13149", "13004", "12814", "12773", "12734", "12724", "12706",
			"12692", "12660", "12658", "12653", "12646", "12524", "12523", "12516",
			"12496", "12462", "12444", "12435", "12424", "12395", "12390", "12097",
			"11782", "11575", "11601", "12025", "12024", "12023", "11862", "14774",
			"14741", "14740", "14739", "14736", "14734", "14733", "14732", "14721",
			"14686", "14685", "14680", "14666", "14664", "14663", "14653", "14652",
			"14630", "14617", "14611", "14608", "14597", "14596", "14592", "14589",
			"14582", "14572", "14561", "14559", "14555", "14552", "14491", "14487",
			"14479", "14477", "14438", "14195", "14194", "14187", "14186", "14184",
			"14182", "14179", "14178", "14174", "14169", "14164", "14162", "14156",
			"14143", "14132", "14129", "14128", "13716", "13708", "13707", "13702",
			"13195", "12290", "12261", "12260", "12257", "11941", "11939", "11934",
			"11931", "11766", "12026", "12006", "11653", "11580", "11567", "12050",
			"12048", "12047", "12039", "11999", "14730", "14729", "14708", "14513",
			"14511", "14507", "14505", "14503", "14499", "14495", "14455", "14449",
			"14417", "14399", "14396", "14394", "14390", "14378", "14373", "14366",
			"14331", "14324", "14322", "14319", "14310", "14301", "14297", "14295",
			"14294", "14291", "14289", "14264", "14259", "14258", "14244", "14234",
			"14232", "14229", "14228", "14226", "14211", "14125", "14123", "14122",
			"14114", "14104", "14102", "14095", "14093", "14092", "14079", "14077",
			"14071", "14061", "14058", "14057", "14056", "14044", "14043", "14034",
			"14026", "14018", "14012", "14010", "13997", "13995", "13985", "13983",
			"13982", "13981", "13978", "13971", "13965", "13948", "13947", "13940",
			"13939", "13935", "13931", "13923", "13914", "13905", "13896", "13895",
			"13892", "13884", "13879", "13852", "13844", "13822", "13821", "13819",
			"13814", "13809", "13799", "13779", "13754", "13749", "13746", "13744",
			"13728", "13691", "13670", "13653", "13650", "13648", "13642", "13636",
			"13622", "13618", "13615", "13602", "13600", "13590", "13582", "13566",
			"13546", "13545", "13543", "13540", "13537", "13534", "13532", "13516",
			"13515", "13513", "13508", "13493", "13489", "13487", "13472", "13468",
			"13462", "13454", "13426", "13403", "13402", "13397", "13383", "13374",
			"13366", "13339", "13332", "13319", "13316", "13301", "13289", "13269",
			"13252", "13242", "13239", "13236", "13218", "13217", "13207", "13205",
			"13204", "13203", "13183", "13180", "13161", "13152", "13150", "13145",
			"13135", "13119", "13117", "13054", "13050", "13037", "13025", "13017",
			"13012", "13009", "12995", "12994", "12988", "12987", "12968", "12967",
			"12937", "12914", "12907", "12903", "12891", "12883", "12882", "12859",
			"12858", "12855", "12854", "12852", "12846", "12844", "12843", "12834",
			"12833", "12826", "12816", "12813", "12812", "12809", "12807", "12802",
			"12800", "12799", "12761", "12730", "12728", "12717", "12693", "12679",
			"12672", "12661", "12659", "12656", "12634", "12629", "12626", "12610",
			"12606", "12602", "12597", "12525", "12502", "12478", "12455", "12437",
			"12434", "12432", "12425", "12403", "12400", "12393", "12382", "12348",
			"12347", "12332", "12321", "12292", "12207", "12133", "11688", "11654",
			"11603", "11597", "13705", "13299", "13193", "12267", "12156", "11899",
			"11650", "11639", "11626", "11623", "11698", "11663", "11658", "11589",
			"12056", "12032", "12031", "12019", "12008", "14772", "14768", "14751",
			"14747", "14746", "14744", "14742", "14738", "14735", "14726", "14725",
			"14724", "14723", "14722", "14720", "14677", "14668", "14667", "14665",
			"14662", "14643", "14641", "14639", "14636", "14634", "14631", "14628",
			"14616", "14615", "14601", "14600", "14598", "14588", "14587", "14581",
			"14580", "14578", "14577", "14576", "14575", "14573", "14564", "14554",
			"14548", "14546", "14543", "14541", "14538", "14531", "14492", "14490",
			"14483", "14482", "14480", "14472", "14471", "14452", "14443", "14442",
			"14201", "14200", "14198", "14193", "14192", "14189", "14180", "14175",
			"14173", "14170", "14166", "14165", "14163", "14161", "14158", "14150",
			"14149", "14148", "14144", "14142", "14141", "14140", "14134", "14130",
			"14127", "12012", "11946", "11720", "11651", "11624", "11610", "14714",
			"14711", "14705", "14703", "14702", "14688", "14529", "14525", "14524",
			"14521", "14519", "14518", "14509", "14468", "14467", "14466", "14465",
			"14463", "14454", "14428", "14406", "14402", "14400", "14398", "14397",
			"14392", "14391", "14386", "14384", "14383", "14376", "14374", "14370",
			"14360", "14359", "14348", "14345", "14341", "14335", "14334", "14328",
			"14318", "14317", "14315", "14305", "14303", "14299", "14290", "14283",
			"14282", "14266", "14260", "14257", "14255", "14250", "14249", "14248",
			"14247", "14245", "14242", "14240", "14236", "14225", "14218", "14215",
			"14214", "14212", "14112", "14109", "14098", "14094", "14089", "14088",
			"14087", "14082", "14081", "14080", "14075", "14065", "14055", "14053",
			"14052", "14037", "14036", "14035", "14033", "14032", "14031", "14027",
			"14024", "14022", "14021", "14019", "14017", "14014", "14002", "13999",
			"13996", "13990", "13977", "13976", "13975", "13972", "13962", "13961",
			"13960", "13956", "13954", "13950", "13945", "13941", "13936", "13934",
			"13929", "13926", "13921", "13919", "13917", "13916", "13913", "13910",
			"13902", "13898", "13891", "13890", "13889", "13880", "13873", "13872",
			"13870", "13869", "13865", "13861", "13854", "13845", "13842", "13832",
			"13831", "13827", "13823", "13817", "13816", "13812", "13811", "13810",
			"13808", "13789", "13786", "13782", "13781", "13771", "13767", "13755",
			"13750", "13748", "13743", "13742", "13693", "13692", "13676", "13673",
			"13667", "13664", "13663", "13656", "13654", "13652", "13647", "13644",
			"13639", "13638", "13634", "13630", "13629", "13623", "13619", "13617",
			"13614", "13603", "13601", "13599", "13595", "13594", "13592", "13583",
			"13578", "13577", "13572", "13560", "13553", "13552", "13549", "13544",
			"13539", "13536", "13531", "13528", "13526", "13523", "13517", "13504",
			"13492", "13483", "13481", "13475", "13474", "13470", "13466", "13457",
			"13456", "13441", "13440", "13433", "13430", "13424", "13420", "13418",
			"13409", "13404", "13401", "13398", "13388", "13386", "13361", "13360",
			"13358", "13352", "13350", "13340", "13338", "13335", "13331", "13330",
			"13329", "13328", "13327", "13326", "13321", "13311", "13306", "13295",
			"13293", "13291", "13286", "13285", "13284", "13282", "13277", "13275",
			"13270", "13263", "13258", "13251", "13250", "13247", "13246", "13244",
			"13241", "13237", "13233", "13231", "13228", "13224", "13221", "13215",
			"13206", "13187", "13184", "13167", "13166", "13162", "13157", "13155",
			"13147", "13099", "13069", "13059", "13056", "13049", "13048", "13033",
			"13031", "13028", "13026", "13024", "13023", "13016", "13015", "13013",
			"13008", "13001", "12989", "12983", "12979", "12977", "12955", "12953",
			"12951", "12950", "12947", "12939", "12936", "12933", "12932", "12926",
			"12923", "12922", "12904", "12895", "12892", "12890", "12876", "12873",
			"12860", "12857", "12850", "12849", "12848", "12845", "12839", "12838",
			"12835", "12831", "12810", "12797", "12753", "12744", "12723", "12714",
			"12705", "12691", "12684", "12682", "12680", "12678", "12675", "12671",
			"12669", "12663", "12655", "12650", "12648", "12643", "12640", "12636",
			"12635", "12633", "12621", "12616", "12613", "12609", "12608", "12603",
			"12601", "12600", "12599", "12594", "12593", "12588", "12585", "12584",
			"12577", "12571", "12570", "12565", "12561", "12559", "12554", "12540",
			"12533", "12519", "12510", "12501", "12497", "12492", "12488", "12487",
			"12479", "12463", "12458", "12451", "12441", "12420", "12419", "12411",
			"12402", "12401", "12397", "12391", "12378", "12363", "12355", "12352",
			"12346", "12325", "12317", "12316", "12313", "12306", "12303", "12293",
			"12237", "12232", "12213", "12131", "12127", "12107", "12101", "11783",
			"11775", "11697", "11691", "11664", "11585", "11582", "11571", "13717",
			"13706", "13704", "13198", "13196", "12351", "12336", "12279"
		];
		let newId = Math.floor(Math.random() * imageIds.length);
		return imageIds[newId];
	}
});
