const Room = require('../models/Room')
const Device = require('../models/Device')
const { sendPushNotification } = require('./firebase.service')

const sendPushNotificationForMessage = async ({roomId, type, content, userId}) => {
	const room = await Room.findOne({ _id: roomId })
    //get user device exept sender
	const device = await Device.find().where('owner').in(room.users).ne('owner', userId)
	const tokens = device.map((d) => d.fcm_token)

	let messageContent = content

	switch (type) {
		case 'text':
			messageContent =
				message.content.length > 20
					? message.content.slice(0, 20) + '...'
					: message.content
			break
		case 'image':
			messageContent = 'Đã gửi ảnh 📷'
			break
		case 'video':
			messageContent = 'Đã gửi video 📽️'
		case 'audio':
			messageContent = 'Đã gửi audio 🎵'
		case 'file':
			messageContent = 'Đã gửi file 📁'
		default:
			break
	}

	await sendPushNotification({
		tokens,
		title: `${message.name} đã nhắn tin`,
		body: messageContent,
		id: message.roomId,
	})
}

module.exports = { sendPushNotificationForMessage }