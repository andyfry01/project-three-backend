var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var mongodb = require('mongodb');
var Promise = require('es6-promise').Promise;
var app = express();

app.use(cors());

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

var MongoClient = mongodb.MongoClient;
var ObjectId = require('mongodb').ObjectID


//Mongo URL, collections
var mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/projectThree';

//default get route
app.get('/', function(request, response){
  response.json({"message": "welcome to the database!"})
});

// route for finding current user's playlist
app.get('/playlist', function(request, response){
  MongoClient.connect(mongoUrl, function(error, db){
    var usersCollection = db.collection('users');
    if (error){
      console.log('error connecting to db:', error);
    } else {
      console.log('searching database for current playlist');

      usersCollection.find({loggedIn:true}).toArray(function (error, result){
        if (error){
          console.log('error finding playlist', error);
        } else if (result.length){
          console.log('current playlist:', result[0].playlist);

          var songsArr = result[0].playlist;
          var songsCollection = db.collection('songs');
          var obj_ids = songsArr.map(function (item){ return ObjectId(item)}); //help from http://stackoverflow.com/questions/29560961/query-mongodb-for-multiple-objectids-in-array
          console.log("the object IDs we pass into the song collection find look like this", obj_ids);
          songsCollection.find({'_id': {'$in': obj_ids}}).sort({_id: -1})
          .toArray(function(error, result){
            if (error){
              console.log('error using $in', error);
            } else {
              console.log('result', result);
              response.json(result);
            }
          })
        } else {
          console.log('no playlist available');
        }
      }) // end usersCollection.find()
    } // end else
  }) // end MongoClient connect()
}) // end get()


// route for finding a user in the database when login is clicked.
// the object that gets sent to this path should look as follows:
//    {
//      'username': <username>
//      'password': <password>
//    }
app.post('/users/find', function(request, response){
  console.log('hey, it looks like youre trying to find a user');
  console.log('this is the request.body', request.body);
  MongoClient.connect(mongoUrl, function(error, db){
    var usersCollection = db.collection('users');
    if (error) {
      console.log('error connecting to db:', error);
    } else {
      console.log('searching database for user information');
      // I'm going to have to experiment with this next line to actually find the user based on the username/pass fields
      usersCollection.find({$and:[{user: request.body.user}, {password: request.body.password}]}).toArray(function (error, result) {
        if (error) {
          console.log("error", error);
          response.json("error")
        } else if (result.length) {
          usersCollection.update({}, {$set: {loggedIn: false}}, {multi: true});
            if ( usersCollection.find({user: request.body.user}, {loggedIn: true}) ) {
              setTimeout(function() {
              usersCollection.update({user: request.body.user}, {$set: {loggedIn: true}});
              console.log("request status:", request.body);
              console.log("set timeout is running");
            }, 1000);
              if ( usersCollection.find({user: result[0].user}, {loggedIn: false}) ) {
                usersCollection.update({user: result[0].user}, {$set: {loggedIn: true}});
                console.log("conditions are met so i am runnin");
                console.log("results log status:", result[0].loggedIn);
              }
            }
      console.log("set timeout has now finished");
          // var promise = new Promise (function(resolve, reject) {
          //   if ( usersCollection.find({user: request.body.user}, {loggedIn: true}) ) {
          //     resolve("changed current user in db to true!");
          //     console.log("this is who you're trying to change:", request.body.user);
          //     usersCollection.update({user: request.body.user}, {$set: {loggedIn: true}})
          //   } else {
          //     reject(Error("had trouble setting loggedIn to true, sorry dude"))
          //   }
          // });//end of promise
          // promise.then(function(result) {
          //
          //   console.log("result from promise is:", result);
          // }, function(err) {
          //   console.log("somethin broke dude:", err);
          // })
          console.log('user found:', result);
          response.json(result);
          console.log("hi the code is reaching this point");
            // if (usersCollection.find({user: result[0].user}, {loggedIn: false})) {
            //   usersCollection.update({user: result[0].user}, {$set: {loggedIn: true}});
            //   console.log("request username looks like:", request.body.user);
            //   console.log("request password looks like:", request.body.password);
            //   console.log("request user's logged in status is:", request.body.loggedIn);
            //   console.log("result username looks like:", result[0].user);
            //   console.log("result logged in status looks like:", result[0].loggedIn);
            // }
        } else {
          console.log('no users found in database with that username/password');
          response.json('no users found in database with that username/password')
        }
        setTimeout(function() {
        db.close(function(){
          console.log("database closed");
        }) //end db.close()
      }, 2000);
      }) //end usersCollection.find()
    } //end else
  }) //end MongoClient connect
}) // end get user


// route for adding a new user to the database
app.post('/users/new', function(request,response){
  console.log('adding new user to the users database:', request.body);
  MongoClient.connect(mongoUrl, function(error, db){
    var usersCollection = db.collection('users');
    if (error) {
      console.log("error connecting to database:", error);
    } else {
      console.log('Adding new user to database');

      //some tweaking probably required to build this object correctly
      var newUser = {
        'user': request.body.user,
        'password': request.body.password,
        'playlist': [],
        'loggedIn': false,
      }

      usersCollection.insert([newUser], function(error, result) {
        if (error) {
          console.log('error adding new user:', error);
        } else {
          console.log('new user added', result);
          console.log("does request still exist?", request.body.user);
          response.json(result)
          usersCollection.update({}, {$set: {loggedIn: false}}, {multi: true});
          usersCollection.update({user: request.body.user}, {$set: {loggedIn: true}})
        }
        setTimeout(function() {
        db.close(function(){
          console.log('database closed');
        }) //end db.close()
       }, 2000)
      }) //end usersCollection.insert()
    } //end else
  }) //end MongoClient connect
}) // end post new user


//route for adding a song to a user's playlist
app.post('/songs/new', function(request, response){
  console.log('adding new song to the songs database:', request.body);
  MongoClient.connect(mongoUrl, function(error, db){
    var usersCollection = db.collection('users')
    var songsCollection = db.collection('songs');
    if (error) {
      console.log("error connecting to database:", error);
    } else {
      console.log('Adding new song to database');
      var newSong = {
        "name": request.body.name,
        "artist": request.body.artist,
        "country": request.body.country,
        "rank": request.body.rank,
        "albumImage": request.body.album_image,
        "songURL": request.body.song_url
      }

      songsCollection.insert([newSong], function(error, result){
        if (error) {
          console.log('error adding new song:', error);
        } else {

          console.log('new song added, here is the id of the song:', result['ops'][0]['_id']);
          response.json(result)

          usersCollection.find({loggedIn:true}).toArray(function (error, result){
            if (error) {
              console.log('error finding logged in user', error);
            } else if (result.length) {
              console.log("logged in user found:", result);
              console.log("logged in user ID", result[0]['_id']);
              var userID = ObjectId(result[0]['_id'])
              songsCollection.find().limit(1).sort({$natural:-1}).toArray(function (error, result){
                if (error) {
                  console.log("error finding song");
                } else if (result.length) {
                    console.log("last song added to songs collection found", result[0]['_id']);
                    var songID = ObjectId(result[0]['_id'])
                    usersCollection.update({'_id': userID}, {$push: {'playlist': songID}})
                }
                db.close(function(){
                  console.log('database closed');
                }) //end db.close()
              })
            }
          })
        }
      }) //end songsCollection.insert()
    } //end else
  }) //end MongoClient connect
}) // end post new song

app.delete('/songs/:_id' , function(request, response){
  var songID = ObjectId(request.params['_id']);
  console.log('song being deleted', songID);

  MongoClient.connect(mongoUrl, function(error, db){
    var usersCollection = db.collection('users');
    var songsCollection = db.collection('songs');
    if (error) {
      console.log('error connecting to db:', error);
    } else {
      console.log('deleting song from songs collection and user songs array');
      usersCollection.update({loggedIn:true}, {$pull: {playlist: songID}})
      songsCollection.remove({_id: songID})
    } // end else
    db.close(function(){
      console.log('database closed');
    }) //end db.close()
  }) // end MongoClient.connect()
}) // end app.delete



app.server.listen(process.env.PORT || 3000, function() {
  console.log("backend now listening");
})
