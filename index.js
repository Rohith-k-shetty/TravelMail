const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://mail.google.com/",
];

// its do auth function to authenticate the user
async function doAuth() {
  //   const credential = await fs.readFile("key.json");
  const auth = await authenticate({
    //give your credentials filename in place of key.json
    keyfilePath: path.join(__dirname, "key.json"),
    scopes: SCOPES,
  });
  return auth;
}

// function to get the message list from which are unreplayed
async function unreplayed(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const response = await gmail.users.messages.list({
    userId: "me",
    q: "-in:chats -from:me -has:userlabels",
  });
  return response.data.messages;
}

//send replay to the unread messages
async function sendreplay(auth, message) {
  //   to get the meta data hreaders to get the from adress
  const gmail = google.gmail({ version: "v1", auth });
  const getfrom = await gmail.users.messages.get({
    userId: "me",
    id: message[0].id,
    format: "metadata",
    metadataHeaders: ["Subject", "From"],
  });

  // to get the sender email adress from the messages
  const from = getfrom.data.payload.headers.find(
    (h) => h.name === "From"
  ).value;

  //styling messages
  const subject = "🤘 Hello in vacation🤘";
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    "From: " + getfrom.data.payload.headers[0].value,
    "To:" + from.match(/<(.*)>/)[1],
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    "This is a message just to say that i am in Vacation.i will connect to  u after a week",
    "So... <b>Hello!</b>  🤘❤️😎",
  ];
  const message1 = messageParts.join("\n");

  const encodedMessage = Buffer.from(message1)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const send = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      id: message[0].id,
      threadId: message[0].threadId,
    },
  });
}

async function createLabel(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  try {
    const labels = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: "Vacation",
        labelListVisibility: "labelshow",
        messageListVisibility: "show",
      },
    });
    console.log(labels.data.id);
    return labels.data.id;
  } catch (err) {
    if (err.code === 409) {
      // label already exists soo
      const labelList = await gmail.users.labels.list({
        userId: "me",
      });
      const label = labelList.data.labels.find((l) => l.name === "Vacation");
      // console.log(label.id);
      return label.id;
    }
  }
}

//add messages to the label id from inbox using modify and reqestbody labels
async function addMessage(id, message, auth) {
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.modify({
    userId: "me",
    id: message[0].id,
    requestBody: {
      addLabelIds: [id],
      removeLabelIds: ["INBOX"],
    },
  });
}

async function main() {
  const auth = await doAuth();
  const id = await createLabel(auth);
  // set a interval for running the function
  setInterval(async () => {
    const message = await unreplayed(auth);
    console.log(message);

    await sendreplay(auth, message);

    console.log(id);

    await addMessage(id, message, auth);
  }, Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000);
}

main();
