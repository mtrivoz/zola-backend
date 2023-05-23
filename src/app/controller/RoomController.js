const Room = require('../../models/Room')
const User = require('../../models/User')
const roomService = require('../../services/room.service')
const mongoose = require('mongoose')

class RoomController {
	// create new chat room need a list of member id
	async createRoom(req, res) {
		try {
			if (req.user) {
				const { name, users, isRoom } = req.body
				const roomData = { name, users, isRoom }
				roomData.created_by = req.user.id
				// Check user add to room is exist\
				const validUserList = await User.exists({
					_id: { $in: roomData.users },
				})

				// if room is 2 user and already exist
				if (roomData.users.length === 1) {
					const objectIdArray = [...roomData.users, req.user.id].map(str => mongoose.Types.ObjectId(str));
					const room = await Room.findOne({
						users: objectIdArray, deleted_at: null
					})
					
					if (room) {
						return res.status(200).json({
							message: 'Room is existed. Cant create new',
							data: room,
						})
					}
				}

				if (isRoom && roomData.users.length === 1) {
					res.status(400).json({
						message: 'A room has to have more than 2 users',
					})
				}

				if (validUserList) {
					roomData.users.push(req.user.id)
					const room = new Room(roomData)
					await room.save()
					res.status(201).json({
						message: 'Create a new chat room',
						data: room,
					})
				} else {
					res.status(400).json({ message: 'Invalid list of user' })
				}
			} else {
				res.status(401).json({ message: 'Not authorize' })
			}
		} catch (err) {
			console.log(err)
			res.status(500).json({ message: 'Server error' })
		}
	}

	async checkRoomWithTwoUser(req, res) {
		try {
			if (req.user) {
				const user = await User.findOne({
					username: req.query.username,
				})
				const room = await Room.findOne({
					users: { $size: 2, $all: [req.user.id, user._id] },
				})
				console.log(room)
				if (room && user) {
					res.status(403).json({
						message: 'Room is existed. Cant create new',
					})
				} else res.status(200).json({ message: 'Room is not existed.' })
			} else {
				res.status(401).json({ message: "Can't access this" })
			}
		} catch (error) {
			console.log(error)
			res.status(500).json({ message: "Can't access this !" })
		}
	}

	async getRoomById(req, res) {
		try {
			if (req.user) {
				const room = await Room.findOne({
					_id: req.params.roomId,
					deleted_at: null,
				})

				if (room.users.includes(req.user.id)) {
					const roomDoc = await Room.getRoomById(req.params.roomId)

					return res.status(200).json({ room: roomDoc })
				} else {
					return res.status(401).json({ error: "Can't access this." })
				}
			} else {
				return res.status(401).json({ message: "Can't access this" })
			}
		} catch (error) {
			console.log(error)
			return res.status(500).json({ message: "Can't access this !" })
		}
	}

	async getRoomByUserById(req, res) {
		try {
			const { limit, offset } = req.query
			let rooms = await roomService.getRoomByUserId(
				req.user.id,
				offset,
				limit
			)

			return res.status(200).json({ Rooms: rooms })
		} catch (err) {
			console.log(err)
			return res.status(500).json('Fail')
		}
	}

	async getRoomBasicInfo(req, res) {
		try {
			let room = await Room.findOne({
				_id: req.params.roomId,
				deleted_at: null,
			})
			return res.status(200).json({ data: room })
		} catch (error) {
			console.log(error)
			return res.status(500).json({ message: "Can't access this !" })
		}
	}

	async getAllUserInRoom(req, res) {
		try {
			const room = await Room.findById(req.query.roomId)
			const users = await Promise.all(
				room.users.map((userId) => User.getUserWithIdLessData(userId))
			)
			res.status(200).json({ user: users })
		} catch (err) {
			console.error('Get all User In Room: ', err)
			res.status(500).json({ Error: err })
		}
	}

	async addUserToRoom() {
		// using $addToSet to void duplicated values
		const room = await Room.findById(req.body.id)
		const user = await User.findOne({ username: req.body.username })
		if (await !User.exists({ _id: req.body.userId })) {
			res.status(401).json({ message: 'User not existed' })
			return
		}
		if (!room.users.includes(req.user.id)) {
			res.status(401).json({ message: 'Not authorization' })
			return
		}
		try {
			if (req.body.userId)
				await Room.updateOne(
					{ _id: req.body.roomId },
					{ $addToSet: { users: req.body.userId } }
				)
			else if (req.body.username)
				await Room.updateOne(
					{ _id: req.body.roomId },
					{ $addToSet: { users: user._id } }
				)

			res.status(200).json({ message: 'Add user to room complete' })
		} catch (err) {
			res.status(500).json({ Error: err })
		}
	}

	async removeUserFromRoom() {
		// using $addToSet to void duplicated values
		const room = await Room.findById(req.body.roomId)
		if (await !User.exists({ _id: req.body.userId })) {
			res.status(401).json({ message: 'User not existed' })
			return
		}
		if (!room.users.includes(req.user.id)) {
			res.status(401).json({ message: 'Not authorization' })
			return
		}
		try {
			await Room.updateOne(
				{ _id: req.body.roomId },
				{ $pull: { users: req.body.userId } }
			)
			res.status(200).json({ message: 'Remove user from room complete' })
		} catch (err) {
			res.status(500).json({ message: 'Server error' })
		}
	}

	// get chat group that user is in
	async getChatGroupByUserId(req, res) {
		try {
			const data = await Room.find(
				{ users: req.user.id, isRoom: true, deleted_at: null },
				'name users createdAt isRoom updatedAt'
			).populate('users', 'fullname username avatarUrl')
			return res.status(200).json({ data })
		} catch (error) {
			console.log(error)
			return res.status(500).json({ message: 'Server error' })
		}
	}

	// leave room
	async leaveRoom(req, res) {
		try {
			const room = await Room.findOne({ _id: req.params.id })
			if (
				room.users.includes(req.user.id) &&
				room.isRoom &&
				room.users.length > 2
			) {
				await Room.updateOne(
					{ _id: req.params.id },
					{ $pull: { users: req.user.id } }
				)
				return res.status(200).json({ message: 'Leave room success' })
			} else {
				return res.status(401).json({ message: "Can't access this" })
			}
		} catch (error) {
			console.log(error)
			return res.status(500).json({ message: 'Server error' })
		}
	}

	// delete room
	async deleteRoom(req, res) {
		try {
			const room = await Room.findOne({ _id: req.params.id })
			if (room.users.includes(req.user.id) && room.isRoom) {
				await Room.updateOne(
					{ _id: req.params.id },
					{ deleted_at: Date.now() }
				)
				return res.status(200).json({ message: 'Delete room success' })
			} else {
				return res.status(401).json({ message: "Can't access this" })
			}
		} catch (error) {
			console.log(error)
			return res.status(500).json({ message: 'Server error' })
		}
	}

	// change room name
	async changeRoomName(req, res) {
		try {
			const room = await Room.findOne({ _id: req.params.id })
			if (req.body.name === null) {
				return res.status(400).json({ message: 'Name cannot null' })
			}
			if (room.users.includes(req.user.id) && room.isRoom) {
				await Room.updateOne(
					{ _id: req.params.id },
					{ name: req.body.name }
				)
				return res
					.status(200)
					.json({ message: 'Change room name success' })
			}
			return res.status(401).json({ message: "Can't access this" })
		} catch (error) {
			return res.status(500).json({ message: 'Server error' })
		}
	}
}

module.exports = new RoomController()
