const mongoose = require('mongoose');
const Schema = mongoose.Schema;
// create a schema
var evalResultSchema = new Schema({
  config: {
    code: String,
    title: String,
    amount: Number,
    positive: String,
    negative: String,
    general: String
  },
  feedback: {
    positive: [{
      val: String,
      userId: String,
      id: String,
    }],
    negative: [{
      val: String,
      userId: String,
      id: String,
    }],
    general: [{
      val: String,
      userId: String,
      id: String,
    }]
  },
  votes: {
    positive: [{
      userId: String,
      id: String
    }],
    negative: [{
      userId: String,
      id: String
    }],
    general: [{
      userId: String,
      id: String
    }]
  },
  created_at: Date,
  updated_at: Date
});

evalResultSchema.pre('save', function (next) {
  const currentDate = new Date().toISOString();

  this.updated_at = currentDate;

  if (!this.created_at)
    this.created_at = currentDate;

  next();
});

const evalResult = mongoose.model('evalResult', evalResultSchema);
module.exports = evalResult;
