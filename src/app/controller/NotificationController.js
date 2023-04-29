const NotificationService = require('../../services/notification.service')
const Device = require('../../models/Device')
const { sendPushNotification, sendCallToMobile } = require('../../services/firebase.service')
const { getIo } = require('../../configs/socket2.config')

const admin = require("firebase-admin");

var serviceAccount = require("../../configs/firebase/zola-firebase-firebase-adminsdk-rjq2h-87c2c684f4.json");

const init = () => {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

class NotificationController {
	async getAllNotification(req, res) {
		try {
			const notifications = await NotificationService.getAllNotification(
				req.user.id
			)
			res.status(200).json({ data: notifications })
		} catch (error) {
			console.log(error)
			res.status(500).json({ message: 'Error' })
		}
	}

	async countUnreadNotification(req, res) {
		try {
			const count = await NotificationService.countUnreadNotification(req.user.id)
			return res.status(200).json({ data: count })
			
		} catch (error) {
			console.log(error)
			return res.status(500).json({ message: 'Error' })
		}
	}

	async getUnreadNotification(req, res) {
		try {
			const count = await NotificationService.countUnreadNotification(
				req.user.id
			)
			res.status(200).json({ data: count })
		} catch (error) {
			console.log(error)
			res.status(500).json({ message: 'Error' })
		}
	}

	async readNotification(req, res) {
		try {
			await NotificationService.readNotification(req.params.id)
			res.status(200).json({ message: 'Read notification successfully' })
		} catch (error) {
			console.log(error)
			res.status(500).json({ message: 'Error' })
		}
	}

	async deleteNotification(req, res) {
        try {
            await NotificationService.deleteNotification(req.params.id)
            return res.status(200).json({message: "Delete notification successfully"})
        } catch (error) {
            console.log(error)
            return res.status(500).json({message: "Error"})
        }
    }

    async deleteAllNotification(req, res) {
        try {
            await NotificationService.deleteAllNotification(req.user.id)
            return res.status(200).json({message: "Delete all notification successfully"})
        } catch (error) {
            console.log(error)
            return res.status(500).json({message: "Error"})
        }
    }

    async readAllNotification(req, res) {
        try {
            await NotificationService.readAllNotification(req.user.id)
            return res.status(200).json({message: "Read all notification successfully"})
        } catch (error) {
            return res.status(500).json({message: "Error"})
        }
    }

	async startVideoCallFromMobile(req, res){
		try {
			const userId = req.body.userId
			const devices = await Device.find({ owner: userId })
			const tokens = devices.map(device => device.fcm_token)

			await sendCallToMobile(tokens, req.body.data)

			return res.status(200).json({message: "Call successfully"})
		} catch (error) {
			console.log(error)
			return  res.status(500).json({message: "Error"})
		}

	}

	async testNotificationFirebase(req, res) {
		try {
			await admin.messaging().sendMulticast({
				tokens: ["dV04mucSTSiu_wF6kCjbwo:APA91bH1TCftVlDRz97z2C4mBn3TQb6h9QQKaqbNgQcwJbjzH_99HXqmaPODjDrXBFq8sICNptGyExoxfF2JM4qjc0EnqHclj7FM9KKmY3cXItG3BxHKg5tHzi9WrIEhhJ3Zfd202eUP"],
				// notification: {
				// 	title: 'Urgent action needed!',
				// 	body: 'Urgent action is needed to prevent your account from being disabled!'
				//   },
				data: {
					"sound": "default", 
					"type": "call",
				},
				options: {
					"priority": "high",
					"timeToLive": 60 * 60 * 24
				  },
			})

			return res.status(200).json({ message: 'Success' })
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: error })
		}
	}
	
}

module.exports = new NotificationController()
