const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['BLOCKED', 'ORDER_PICKUP', 'PUBLIC_EVENT'], default: 'BLOCKED' },
  date: { type: String, required: true }, // YYYY-MM-DD
  title: { type: String, required: true },
  location: { type: String, default: '' },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  time: { type: String, default: '' },        // display string e.g. "12pm - 8pm"
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  tags: [{ type: String }],
}, { timestamps: true });

calendarEventSchema.index({ owner: 1, date: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
