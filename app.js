//just a try error code which i frist developed
//frist developed code
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { gmail } = require("googleapis/build/src/apis/gmail");
const { content } = require("googleapis/build/src/apis/content");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://mail.google.com/",
];
async function get(req, res) {
  //read the credentials file from module
  const credential = await fs.readFile("key.json");

  //authenticate the user and call gmail UPI
  const auth = await authenticate({
    keyfilePath: path.join(__dirname, "key.json"),
    scopes: SCOPES,
  });

  // console.log("the user is ", auth);

  const gmail = google.gmail({ version: "v1", auth });

  //get all the list of labels from the gmail which is un replayed
  const response = await gmail.users.messages.list({
    userId: "me",
    q: "-in:chats -from:me -has:userlabels",
  });
  // console.log(response.data);

  const response2 = await gmail.users.messages.get({
    userId: "me",
    id: response.data.messages[0].id,
    format: "metadata",
    metadataHeaders: ["Subject", "From"],
  });

  //to get the adress of the people
  const from = response2.data.payload.headers.find(
    (h) => h.name === "From"
  ).value;
  console.log(from);

  const subject = "🤘 Hello 🤘";
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    "From: " + response2.data.payload.headers[0].value,
    "To:" + from.match(/<(.*)>/)[1],
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    "This is a message just to say hello.",
    "So... <b>Hello!</b>  🤘❤️😎",
  ];
  const message = messageParts.join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const send = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      id: response.data.messages[0].id,
      threadId: response.data.messages[0].threadId,
    },
  });

  //creating a label and rfeturning the id of the label and returning the label id
  async function createLabel() {
    try {
      const labels = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: "Vacation",
          labelListVisibility: "labelshow",
          messageListVisibility: "show",
        },
      });

      return labels.data.id;
    } catch (err) {
      if (err.code === 409) {
        // label already exists soo
        const labelList = await gmail.users.labels.list({
          userId: "me",
        });
        const label = labelList.data.labels.find((l) => l.name === "Vacation");
        return label.id;
      }
    }
  }

  const id = await createLabel();

  //add messages to the label id from inbox using modify and reqestbody labels
  async function addMessage(id) {
    gmail.users.messages.modify({
      userId: "me",
      id: response.data.messages[0].id,
      requestBody: {
        addLabelIds: [id],
        removeLabelIds: ["INBOX"],
      },
    });
  }
  addMessage(id);
}

get();
