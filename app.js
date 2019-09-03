const puppeteer = require('puppeteer');
const $ = require('cheerio');
const colors = require('colors');

/*
1. Go to https://sis.rutgers.edu/soc/#home and search for your class.
2. Put that link in url variable
3. Input the rest of your information.
4. Run with node "app.js"
*/
const sectionNumbers = [02,04,06,08];
const sectionIndexNumbers = ['02208','15888','00310','00312']
const NETID = process.env.NETID;
const PASSWORD = process.env.PASSWD;
const delayBetweenChecks = 2000; //milliseconds

function ClassToRegister(url, sectionNumber, sectionIndexNumber, i) {
  this.url = url;
  this.sectionNumber = sectionNumber;
  this.sectionIndexNumber = sectionIndexNumber;
  this.i = i;
}

function generateURL(sectionIndexNumber) {
  return "https://sis.rutgers.edu/soc/#keyword?keyword=" + sectionIndexNumber + "&semester=92019&campus=NB&level=U";
}

function start() {
  if (sectionNumbers.length != sectionIndexNumbers.length) {
    console.log("incorrect inputs");
    return;
  }
  for (var i = 0; i < sectionNumbers.length; i++) {
    var classToRegister = new ClassToRegister(generateURL(sectionIndexNumbers[i]), sectionNumbers[i], sectionIndexNumbers[i], i);
    getScheduleInfo(classToRegister);
  }
}


//go to course schedule planner
function getScheduleInfo(course) {

  try {
    puppeteer.launch({
      headless: false
    }).then(async browser => {

var bodyHTML = null;

      var schedulePage = await browser.newPage();

      do {
        try {

          if(bodyHTML==null){
          await schedulePage.goto(course.url, {
            waitUntil: 'networkidle2'
          });
        }
        else{
          await schedulePage.reload();
        }

          bodyHTML = await schedulePage.evaluate(() => document.body.outerHTML);
        } catch (e) {
          console.log(e);
        }
        await sleep(delayBetweenChecks);
        var status = await checkAndRegister(bodyHTML, course);
      } while (status == false);

      await browser.close();


    });
  } catch (e) {
    console.log(e);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTimeoutFunc(param) {
  return function() {
    // does something with param
  }
}

function saveToFile(item) {
  const fs = require('fs');
  fs.writeFile("debug.html", item, function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  });
}

function checkAndRegister(html, course) {


  var gotClass = false;
  if (html === null) {
    return gotClass;
  }
    let browsers = [];
  //iterate through all open classes
  $('.sectionopen', html).each(function() {
    if ($(this).text() == course.sectionNumber) {
      console.log(course.sectionIndexNumber + " is open. Attempting to register.  ".green);
      //go to webreg and attempt registeration
      try {
        puppeteer.launch({
          headless: true
        }).then(async browser => {
            browsers.push(browser);
          var registerPage = await browser.newPage();

          await registerPage.goto('https://sims.rutgers.edu/webreg/', {
            waitUntil: 'networkidle2'
          });
          //this sequence starts at webreg landing page and ends at registration.
          await registerPage.evaluate(() => {
            document.querySelectorAll('a')[0].click();
          }, {
            waitUntil: 'networkidle2'
          });

          await registerPage.waitForNavigation();
          await registerPage.focus('#username');
          await registerPage.keyboard.type(NETID);
          await registerPage.focus('#password');
          await registerPage.keyboard.type(PASSWORD);
          //console.log(0);
          await registerPage.click('#fm1 > fieldset > div:nth-child(7) > input.btn-submit');

          //choose semester
          try {
            await registerPage.waitForSelector('#wr > div');
            await registerPage.click("#wr > div");
          } catch (e) {
            console.log("Failed to log in. netid/ password is incorrect.");
          }

          await registerPage.waitForSelector('#i1');
          await registerPage.focus('#i1');
          await registerPage.keyboard.type(course.sectionIndexNumber);
          await registerPage.waitFor(300);
          await registerPage.click('#submit');
          await registerPage.waitFor(30000);

          var text = null;
          try {
            text = await registerPage.evaluate(() => document.querySelector('.ok').textContent);
          } catch (e) {
            try {
              text = await registerPage.evaluate(() => document.querySelector('.error').textContent);
            } catch (e) {
              console.log(e);
              console.log("Class already closed or page timed out.");
            }
          }
          console.log(text);

          if (text.includes("success") || text.includes("You are already registered for course ")) {
            console.log(("Successfully registered for " + course.sectionIndexNumber + ". Shutting down...   " + new Date(Date.now()).toLocaleString()).green);
            await registerPage.close();
            gotClass=true;
            await browser.close();
              browsers.forEach(b) => {
                await b.close();
              };
            return;
          }
          else{
            console.log(("Registeration error occurred for " + course.sectionIndexNumber + ". Retrying...   " + new Date(Date.now()).toLocaleString()).blue);
            await registerPage.close();
            await browser.close();
          }
        });
      } catch (error) {
        console.log(error);
      }
    }
  });
  console.log((NETID + " " + course.sectionIndexNumber + " not open. Retrying...   " + " ").red + new Date(Date.now()).toLocaleString());
  return gotClass;
}
start();
