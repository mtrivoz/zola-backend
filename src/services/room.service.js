const Room = require('../models/Room')
const User = require('../models/User')

class RoomService {
	async createRoom(roomData) {
		try {
			const room = new Room(roomData)
			await room.save()
			return room
		} catch (error) {
			console.log(error)
			return null
		}
	}

	async getRoomByUserId(userId, offset = 1, limit = 10) {
		try {
			const user = await User.findById(userId)
			const room = await Room.aggregate([
			    { $match: { users: user._id, deleted_at: null } },
			    {
			      $lookup: {
			        from: "messages",
			        let: { roomId: "$_id" },
			        pipeline: [
			          {
			            $match: {
			              $expr: {
			                $and: [
			                  { $eq: ["$roomId", "$$roomId"] },
			                  { $eq: ["$deleted_at", null] },
			                ],
			              },
			            },
			          },
			          { $sort: { created_at: -1 } },
			          { $limit: 1 },
			        ],
			        as: "last_message",
			      },
			    },
				// look up for users info
				{
					$lookup: {
					from: 'users',
					localField: 'users',
					foreignField: '_id',
					as: 'users_info',
					}
				},
				// look up for sender info
				{
					$lookup: {
					from: 'users',
					localField: 'last_message.sender',
					foreignField: '_id',
					as: 'sender_info',
					}
				},

				// add sender fullname to last message
				{
					$addFields: {
					"last_message.sender_fullname": {
						$ifNull: [{$arrayElemAt: ["$sender_info.fullname", 0]}, null]
					}
					}
				},
					{ $unwind: { path: "$last_message", preserveNullAndEmptyArrays: true } },
					{ $unwind: { path: "$sender_info", preserveNullAndEmptyArrays: true } },
					{
						$project: {
							name: 1,
							created_by: 1,
							isRoom: 1,
							admin: 1,
							created_at: 1,
							updated_at: 1,
							"last_message.content": 1,
							"last_message.type": 1,
							"last_message.created_at": 1,
							"last_message.sender_fullname": 1,
							"users_info.fullname": 1,
							"users_info.username": 1,
							"users_info.avatarUrl": 1,
							// users: 0
						},
					},
					{ $sort: { "last_message.created_at": -1 } },
					// { $skip: offset },
					// { $limit: limit },
			  ])
			  
			  // change users_info to users
			  for (let i = 0; i < room.length; i++) {
				room[i].users = room[i].users_info
				delete room[i].users_info
			  }

			return room
		} catch (error) {
			console.log(error)
			return null
		}
	}
}

module.exports = new RoomService()