export const LinkedInSelectors = {
  profile: {
    actionButtons: [
      'button:has-text("Message")',
      'button:has-text("Connect")',
      'button:has-text("Follow")',
      'button:has-text("Following")',
    ],
  },
  messaging: {
    openButton: ['button:has-text("Message")'],
    composeBox: ['.msg-form__contenteditable', '[contenteditable="true"][role="textbox"]'],
    sendButton: ['.msg-form__send-button', 'button[type="submit"]'],
  },
  connection: {
    connectButton: ['button:has-text("Connect")'],
    addNoteButton: ['button:has-text("Add a note")'],
    noteField: ['textarea[name="message"]', 'textarea#custom-message'],
    sendInviteButton: ['button:has-text("Send"), button:has-text("Send invitation")'],
  },
};
