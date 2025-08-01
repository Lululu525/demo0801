const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(bodyParser.json());
mongoose.connect('mongodb://localhost:27017/legacydemo');

const UserSchema = new mongoose.Schema({
  email: String,
  pwd: String,
  name: String,
  lastLogin: Date,
  legacy: {
    days: Number,
    notifyName: String,
    notifyGmail: String,
    notifyRelation: String
  },
  notified: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

// 註冊
app.post("/api/register", async (req,res) => {
  const {email, pwd, name} = req.body;
  if(await User.findOne({email})) return res.json({error:"Email已註冊"});
  await User.create({email, pwd, name, lastLogin: new Date()});
  res.json({success: true});
});

// 登入
app.post("/api/login", async (req,res) => {
  const {email, pwd} = req.body;
  const user = await User.findOne({email, pwd});
  if(!user) return res.json({error:"帳號或密碼錯誤"});
  user.lastLogin = new Date();
  await user.save();
  res.json({token: user._id, name: user.name});
});

// 設定死後繼承
app.post("/api/legacy-setting", async (req,res)=>{
  const {token, days, notifyName, notifyGmail, notifyRelation} = req.body;
  const user = await User.findById(token);
  if(!user) return res.json({error:"未找到使用者"});
  user.legacy = {days, notifyName, notifyGmail, notifyRelation};
  user.notified = false;
  await user.save();
  res.json({success:true});
});

// Nodemailer Gmail 設定（必須用應用程式密碼，不可用一般密碼）
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'YOUR_GMAIL@gmail.com',
    pass: 'YOUR_APP_PASSWORD'
  }
});

// 定期檢查 & 寄信
setInterval(async ()=>{
  const now = new Date();
  const users = await User.find({});
  for(const user of users){
    if(!user.legacy || !user.legacy.days || !user.legacy.notifyGmail) continue;
    if(!user.lastLogin) continue;
    if(user.notified) continue;
    const inactiveDays = (now - user.lastLogin) / (1000*60*60*24);
    if(inactiveDays >= user.legacy.days){
      // 寄信給通知人
      await mailer.sendMail({
        from: 'YOUR_GMAIL@gmail.com',
        to: user.legacy.notifyGmail,
        subject: 'Digital Legacy 死後通知',
        text: `親愛的 ${user.legacy.notifyName}，
您的 ${user.name} (${user.email}) 已超過 ${user.legacy.days} 天未登入，請確認狀態。
關係：${user.legacy.notifyRelation}`
      });
      user.notified = true;
      await user.save();
    }
  }
}, 60*60*1000); // 每小時檢查一次

app.listen(3000, ()=>console.log("Server running on port 3000"));