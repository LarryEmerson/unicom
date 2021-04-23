const util = require('util')
const axios = require('axios');
const fs = require('fs-extra');
const crypto = require('crypto');
let targetName = ''
var transParams = (data) => {
    let params = new URLSearchParams();
    for (let item in data) {
        params.append(item, data['' + item + '']);
    }
    return params;
};
var notify_logs = {}
var wrapper_color = (type, msg) => {
    if (process.stdout.isTTY) {
        if (type === 'error') {
            msg = `\x1B[31m${msg}\x1B[0m`
        } else if (type === 'reward') {
            msg = `\x1B[36m${msg}\x1B[0m`
        }
    }
    if (type === 'error') {
        msg = '[❌🤣🌋] ' + msg
    } else if (type === 'reward') {
        msg = '[✅🤩🍗] ' + msg
    }
    return msg
}
var stdout_task_msg = (msg) => {
    if ('current_task' in process.env && process.env.current_task) {
        msg = `${process.env.current_task}: ` + msg
    }
    process.stdout.write(msg + '\n')
}
console.notify = function () {
    if ('current_task' in process.env) {
        if (!(process.env.current_task in notify_logs)) {
            notify_logs[process.env.current_task] = []
        }
        console.info('notify',process.env.current_task,util.format.apply(null, arguments))
        notify_logs[process.env.current_task].push(util.format.apply(null, arguments) + '\n')
    }
    stdout_task_msg(util.format.apply(null, arguments))
}
console.log2 = console.log
console.log = function () {
    if (process.env.asm_verbose === 'true') {
        stdout_task_msg(util.format.apply(null, arguments))
    }
    let str = ''
    for (let i = 0; i < arguments.length; i++) {
        str += arguments[i] + ' '
    }
    console.log2(str)
}

console.info = function () {
    stdout_task_msg(util.format.apply(null, arguments))
}

console.error = function () {
    stdout_task_msg(wrapper_color('error', util.format.apply(null, arguments)))
}

console.reward = function () {
    let type, num
    if (arguments.length === 2) {
        type = arguments[0]
        num = arguments[1]
    } else if (arguments.length === 1) {
        type = arguments[0]
        num = 1

        if (arguments[0].indexOf('奖励积分') !== -1) {
            type = 'integral'
            num = parseInt(arguments[0])
        }
        if (arguments[0].indexOf('通信积分') !== -1) {
            type = 'txintegral'
            num = parseInt(arguments[0])
        }
        if (arguments[0].indexOf('定向积分') !== -1) {
            type = 'dxintegral'
            num = parseInt(arguments[0])
        }
    }

    stdout_task_msg(wrapper_color('reward', util.format.apply(null, [type, num])))

    let taskJson = fs.readFileSync(process.env.taskfile).toString('utf-8')
    taskJson = JSON.parse(taskJson)
    if (!('rewards' in taskJson)) {
        taskJson['rewards'] = {}
    }
    let rewards = taskJson.rewards
    if (!(type in rewards)) {
        rewards[type] = parseInt(num || 0)
    } else {
        rewards[type] += parseInt(num || 0)
    }
    taskJson['rewards'] = rewards

    fs.writeFileSync(process.env.taskfile, JSON.stringify(taskJson))
}

var notify = {
    dingtalk_send: async (desp) => {
        if (desp.length) {
            let ddToken = process.env.notify_dingtalk_token
            let ddSecret = process.env.notify_dingtalk_secret
            console.info('使用dingtalk机器人推送消息')
            const dateNow = Date.now();
            const hmac = crypto.createHmac('sha256', ddSecret);
            hmac.update(`${dateNow}\n${ddSecret}`);
            const result = encodeURIComponent(hmac.digest('base64'));
            await axios({
                url: `https://oapi.dingtalk.com/robot/send?access_token=${ddToken}&timestamp=${dateNow}&sign=${result}`,
                method: 'post',
                data: {"msgtype": "text", "text": {content: desp}}
            }).catch(err => console.info('dingtalk_send 发送失败'))
        }
    },
    buildMsg: () => {
        let msg = ''
        for (let taskName in notify_logs) {
            let target = targetName || taskName
            msg += `**以下为${target}任务消息**\n\n`
            msg += notify_logs[taskName].join('\n')
        }
        return msg
    },
    sendLog: async (taskname) => {
        targetName = taskname
        console.info('sendLog', taskname)
        if (process.env.notify_dingtalk_token && process.env.notify_dingtalk_secret) {
            notify.dingtalk_send(notify.buildMsg() || '无推送内容')
        }
        notify_logs = {}
    }
}

console.sendLog = notify.sendLog

module.exports = notify
