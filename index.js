const agoraFormView = document.getElementById("agoraForm");
const inputUID = document.getElementById("inUid");
const btnJoin = document.getElementById("btnJoin");

let browser = {
  name: null,
  version: null,
};
let remoteScreenShareId = null;

// users uid
// sample of getting users list from API
let userLists = [];
let localUserId = null;
let localScreenShareId = null;
let joinedUsers = [];

AgoraRTC.setLogLevel(4);
const screenClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
  videoTrack: null,
  audioTrack: null,
};
var screenShareTracks = {
  videoTrack: null,
  audioTrack: null,
};

var options = {
  appid: "",
  channel: "",
  uid: null,
  token: "",
};

window.onload = () => {
  console.log("PLATFORM :: ", platform.toString());
  const { name, version } = platform;
  browser = {
    name,
    version: parseFloat(version),
  };

  getUsers();
};

// Get Users (Sample)
const getUsers = () => {
  const res = [1, 2, 3];
  userLists = res;
};

inputUID.addEventListener("input", (event) => {
  const regex = /^[0-9]*$/g;
  const { value } = event.target;
  const inputValue = value.match(regex);

  if (inputValue && inputValue[0]) {
    document.getElementById("btnJoin").disabled = false;
    options = {
      ...options,
      uid: parseInt(inputValue[0]),
    };
  } else {
    document.getElementById("btnJoin").disabled = true;
  }
});

const handleLeave = async () => {
  try {
    document.getElementById(`player-${localUserId}`).remove();
    localTracks.videoTrack.close(`player-${localUserId}`);
    localTracks.audioTrack.close();
    await client.unpublish(Object.values(localTracks));
    await screenClient.unpublish(screenShareTracks.videoTrack);
    await screenClient.leave();
    await client.leave();
    joinedUsers = [];
    document.getElementById("inUid").disabled = false;
    document.getElementById("list").innerHTML = null;
  } catch (err) {
    console.log("handleLeave - error :: ", err);
  }
};

const handleMic = async (text) => {
  try {
    if (text === "unmute") {
      // will unmute
      await client.publish(localTracks.audioTrack);
      document.getElementById("micBtn").innerHTML = "Mic: On";
      document.getElementById("micBtn").onclick = () => {
        handleMic("mute");
      };
    } else {
      //will mute
      await client.unpublish(localTracks.audioTrack);
      document.getElementById("micBtn").innerHTML = "Mic: Off";
      document.getElementById("micBtn").onclick = () => {
        handleMic("unmute");
      };
    }
  } catch (err) {
    console.log("handleMic - Error :: ", err);
  }
};

const handleVideo = async (text) => {
  console.log({ text });
  try {
    if (text === "on") {
      localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
      await client.publish(localTracks.videoTrack);
      localTracks.videoTrack.play(`player-${localUserId}`);
      document.getElementById("vidBtn").innerHTML = "Video: On";
      document.getElementById("vidBtn").onclick = () => {
        handleVideo("off");
      };
    } else {
      localTracks.videoTrack.close(`player-${localUserId}`);
      await client.unpublish(localTracks.videoTrack);
      document.getElementById("vidBtn").innerHTML = "Video: Off";
      document.getElementById("vidBtn").onclick = () => {
        handleVideo("on");
      };
    }
  } catch (err) {
    console.log("handleVideo - err :: ", err);
  }
};

const checkCompatibility = () => {
  const { name, version } = browser;

  isChromeCompatible = name.toUpperCase().includes("CHROME") && version > 72;
  isSafariCompatible = name.toUpperCase().includes("SAFARI") && version > 13;
  isFirefoxCompatible = name.toUpperCase().includes("FIREFOX") && version > 56;

  if (isChromeCompatible || isSafariCompatible || isFirefoxCompatible) {
    return true;
  }
  return false;
};

const handleShareScreen = async ({ text, uid }) => {
  try {
    const isCompatible = checkCompatibility();
    if (!isCompatible) {
      alert("Your browser does not support screen sharing");
    } else {
      let screenShareNode = document.getElementById("screenShare");
      if (text === "stop") {
        // stop sharing
        await screenClient.unpublish(screenShareTracks.videoTrack);
        screenShareNode.style.display = "none";
        document.getElementById("shareBtn").innerHTML = "Share Screen";
        document.getElementById("shareBtn").onclick = () => {
          handleShareScreen({ text: "start", localScreenShareId });
        };
      } else {
        // start sharing
        screenShareTracks.videoTrack = await AgoraRTC.createScreenVideoTrack(
          {
            encoderConfig: {
              framerate: 15,
              width: 1920,
              height: 1080,
            },
          },
          "auto"
        );
        await screenClient.publish(screenShareTracks.videoTrack);
        screenShareNode.style.display = "block";
        document.getElementById("screenShareUid").innerHTML =
          localScreenShareId;
        screenShareTracks.videoTrack.play("screenShare");
        document.getElementById("shareBtn").innerHTML = "Stop Sharing";
        document.getElementById("shareBtn").onclick = () => {
          handleShareScreen({ text: "stop", localScreenShareId });
        };
      }
    }
  } catch (err) {
    console.log("handleShareScreen - Error :: ", err);
  }
};

const onJoin = async () => {
  try {
    document.getElementById("inUid").disabled = true;
    document.getElementById("btnJoin").disabled = true;

    localScreenShareId = await screenClient.join(
      options.appid,
      options.channel,
      options.token
    );
    localUserId = await client.join(
      options.appid,
      options.channel,
      options.token,
      options.uid
    );
    renderLocalUser(localUserId);

    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);

    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
    await client.publish(Object.values(localTracks));
    localTracks.videoTrack.play(`player-${localUserId}`);

    joinedUsers = [...joinedUsers, parseInt(localUserId)];
    document.getElementById("inUid").value = "";
  } catch (err) {
    console.log("onJoin - Error :: ", { err });
  }
};

// ========================================================================================================================================================================
// === LISTENERS ==========================================================================================================================================================
// ========================================================================================================================================================================
const handleUserPublished = async (user, mediaType) => {
  const { uid } = user;
  const isUser = userLists.some((userUid) => userUid === parseInt(uid));

  if (isUser) {
    // subscribe(user, mediaType);
    await client.subscribe(user, mediaType);
    if (mediaType === "video") {
      // renderRemoteUser(user);
      user.videoTrack.play(`player-wrapper-${uid}`);
      document.getElementById(`player-${uid}-tag`).style.display = "block";
      document.getElementById(`player-${uid}-placeholder`).style.display =
        "none";
    }
    if (mediaType === "audio") {
      document.getElementById(`player-${uid}-mic`).style.display = "none";
      user.audioTrack.play();
    }
  } else if (localScreenShareId !== uid) {
    await client.subscribe(user, mediaType);
    let screenShareNode = document.getElementById("screenShare");
    screenShareNode.style.display = "block";
    user.videoTrack.play("screenShare");
    document.getElementById("screenShareUid").innerHTML = uid;
    remoteScreenShareId = uid;
  }
};

const handleUserUnpublished = (user, mediaType) => {
  const { uid } = user;
  const isUser = userLists.some((userUid) => userUid === parseInt(uid));
  if (uid === remoteScreenShareId) {
    document.getElementById(`screenShare`).remove();
    remoteScreenShareId = null;
  } else if (isUser && mediaType === "video") {
    document.getElementById(`player-${uid}-placeholder`).style.display =
      "block";
    document.getElementById(`player-${uid}-tag`).style.display = "none";
    // document.getElementById(`player-wrapper-${uid}`).remove();
  } else if (isUser && mediaType === "audio") {
    document.getElementById(`player-${uid}-mic`).style.display = "block";
  }
};

const handleUserJoined = (user) => {
  console.log("handleUserJoined :: ", user);
  const { uid } = user;
  const isUser = userLists.some((userUid) => userUid === parseInt(uid));
  if (isUser) {
    renderRemoteUser(user);
    joinedUsers = [...joinedUsers, parseInt(uid)];
  }
};

const handleUserLeft = (user) => {
  const { uid } = user;
  joinedUsers = joinedUsers.filter((id) => id !== parseInt(uid));
  document.getElementById(`player-wrapper-${uid}`).style.display = "none";
};

// ========================================================================================================================================================================
// === RENDERS ============================================================================================================================================================
// ========================================================================================================================================================================
const renderLocalUser = (id) => {
  var ul = document.getElementById("list");
  var li = document.createElement("li");

  li.innerHTML = `
          <div id="player-${id}" class="player">
            <div class="player-user-info"><p>USER: ${id}</p></div>
            <div id="local-player" class="player-buttons-wrapper">
              <button class="player-button" id="micBtn" onclick="handleMic('mute')">Mic: On</button>            
              <button class="player-button" id="vidBtn" onclick="handleVideo('off')">Video: On</button>            
              <button class="player-button" id="shareBtn" onclick="handleShareScreen({text:'start', uid:${id}})">Share Screen</button>
              <button class="player-button" id="leaveBtn" onclick="handleLeave()">Leave</button>        
            </div>
          </div>
        `;

  ul.appendChild(li);
};

const renderRemoteUser = (user) => {
  const { uid } = user;
  var ul = document.getElementById("list");
  var li = document.createElement("li");
  const nodeId = `player-wrapper-${uid}`;

  li.innerHTML = `
         <div id=${nodeId} class="player">
            <div class="player-user-placeholder" id="player-${uid}-placeholder"><p>${uid}</p></div>
            <div class="player-user-info" id="player-${uid}-tag"><p>USER: ${uid}</p></div>
            <div class="player-user-mic-info" id="player-${uid}-mic"><p>Muted</p></div>
        </div>`;
  ul.appendChild(li);
};
