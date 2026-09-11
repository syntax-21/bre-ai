const fs = require('fs');
const path = require('path');
const REMINDERS_PATH = path.join(process.cwd(), 'data', 'reminders.json');
let reminders = [];

function loadReminders() {
  try {
    if (fs.existsSync(REMINDERS_PATH)) {
      reminders = JSON.parse(fs.readFileSync(REMINDERS_PATH, 'utf8'));
      if (!Array.isArray(reminders)) reminders = [];
    }
  } catch (e) { reminders = []; }
}

function saveReminders() {
  try {
    const dir = path.dirname(REMINDERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REMINDERS_PATH, JSON.stringify(reminders, null, 2), 'utf8');
  } catch (e) {}
}

function addReminder(chatId, message, delayMinutes, senderName = '') {
  const id = 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const dueAt = Date.now() + delayMinutes * 60 * 1000;
  reminders.push({ id, chatId, message, senderName, dueAt, created: Date.now(), sent: false });
  saveReminders();
  return id;
}

function getDueReminders() {
  const now = Date.now();
  return reminders.filter(r => !r.sent && r.dueAt <= now);
}

function markReminderSent(id) {
  const r = reminders.find(x => x.id === id);
  if (r) { r.sent = true; saveReminders(); }
}

function getUserReminders(chatId) {
  return reminders.filter(r => r.chatId === chatId && !r.sent);
}

function cancelReminder(id, chatId) {
  const idx = reminders.findIndex(r => r.id === id && r.chatId === chatId && !r.sent);
  if (idx >= 0) { reminders.splice(idx, 1); saveReminders(); return true; }
  return false;
}

loadReminders();

module.exports = { addReminder, getDueReminders, markReminderSent, getUserReminders, cancelReminder, loadReminders };
