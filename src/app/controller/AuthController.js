const User = require('../../models/User')
const bcrypt = require('bcrypt')
const { sendMail } = require('../../utils/mailHandler')
const {
	generateAllToken,
	verifyToken,
	generateAccessToken,
} = require('../../utils/jwtHandle')
const { generateUsername } = require('../../utils/genarateUsername')
const redis = require('../../services/redis.service')
const { CODE_SUCCESS, CODE_ERROR } = require('../../constants/serviceCode')

require('dotenv/config')

class AuthController {
	async isUserExisted(req, res) {
		try {
			const usernameLogin =
				req.body.email || req.body.phone || req.body.username
			if (
				await User.exists({
					$or: [
						{ phone: usernameLogin },
						{ email: usernameLogin },
						{ username: usernameLogin },
					],
				})
			)
				res.status(200).json({ message: 'User valid' })
			else res.status(404).json({ message: 'Not found' })
		} catch (error) {
			res.status(400).json({ message: 'Error' })
		}
	}

	async login(req, res) {
		try {
			const usernameLogin =
				req.body.email || req.body.phone || req.body.username

			const user = await User.findOne({
				$or: [
					{ phone: usernameLogin },
					{ email: usernameLogin },
					{ username: usernameLogin },
				],
			})

			// if user is null mean not registered yet
			if (!user) {
				return res.status(400).json({
					message: 'This account has not registered yet',
				})
			}

			if(user.deleted_at)
				return res.status(400).json({message: "This account has been deleted"})


			const { id, fullname, username, avatarUrl } = user
			const validPassword = await bcrypt.compare(
				req.body.password,
				user.password
			)

			if (validPassword) {
				const token = generateAllToken({
					id,
					username,
					fullname,
					avatarUrl,
				})

				// set refresh token in redis db
				redis.deleteRefreshToken(id)
				const redisResponse = redis.setRefreshToken(
					id,
					token.refreshToken
				)
				if (redisResponse === CODE_ERROR) {
					res.status(500).json({ error: 'Server error' })
					return
				}

				
				console.log({ refresh: token.refreshToken })
				res.cookie('refreshToken', token.refreshToken, {
					httpOnly: true,
					sameSite: 'none',
					// process.env.NODE_ENV === 'development' ? true : 'none',
					secure:
						process.env.NODE_ENV === 'development' ? false : true,
					// maxAge: 36000
					maxAge:  1000 * 60 * 60 * 24 * 365,
				})
					.status(200)
					.json({
						token: token.accessToken,
						user: { id, fullname, username, avatarUrl },
					})
					.end()
			} else {
				res.status(400).json({
					message: 'Invalid Phone, Email, Username or Password',
				})
			}
		} catch (err) {
			console.log('Login:', err.message)
			res.status(500).json({ error: 'Error' })
		}
	}

	async logout(req, res) {
		try {
			const response = await redis.deleteRefreshToken(req.user.id)
			if (response === CODE_SUCCESS) {
				res.clearCookie('refreshToken')
				return res.status(200).json({ message: 'Log out' }).end()
			}
			return res.status(400).json({ message: 'Error' })
		} catch (error) {
			console.log('Log out: ', error)
			res.status(500).json({message:"Error"})
		}
	}

	async register(req, res) {
		try {
			const {fullname, email, phone, password, birthday} = req.body

			const registerData = {fullname, email, phone, password, birthday}

			if(!(email || phone))
				return res.status(400).json({message: "Need email or password to register"})

			// const currentUser = User.find({email: registerData.email})
			// if(!currentUser)
			//     res.status(400).json({message: "This email was used for another account"})
			// //hash password
			const salt = await bcrypt.genSalt(10)
			const hashPassword = await bcrypt.hash(registerData.password, salt)

			const user = new User(registerData)
			user.password = hashPassword
			user.birthday = new Date(user.birthday)
			// gen username
			user.username = generateUsername(user.fullname)

			await user.save()
			res.status(200).json({ message: 'Register successful' })
			console.log('Create new user successful')
		} catch (error) {
			console.log('Register:', error.message)
			res.status(500).json({ message: 'Register fail' })
		}
	}

	// logout(req, res) {
	// 	const refreshToken = req.cookies.refreshToken
	// 	if (refreshToken == null) return res.sendStatus(401)
	// 	try {
	// 		// verify if this is a refresh token
	// 		const user = verifyToken('refresh', refreshToken)
	// 		if (user) {
	// 		}
	// 		res.clearCookie('refreshToken')
	// 		res.status(200).json({ message: 'logout success' })
	// 		res.end()
	// 	} catch (err) {
	// 		res.sendStatus(500)
	// 	}
	// }
	async changePassword(req, res) {
		try {
			// check accessToken
			const userData = req.user
			if (!userData) {
				//hash password
				const salt = await bcrypt.genSalt(10)
				const hashPassword = await bcrypt.hash(req.body.password, salt)

				const user = await new User.find(
					{ username: userData.username },
					{ $set: { password: hashPassword } }
				)
				await user.save()
				res.json({ message: 'Change password successfully' })
			} else {
				res.status(401).json({ message: 'Authentication' })
			}
		} catch (error) {
			console.log('Change Password: ', error.message)
			res.status(500).json({ message: 'Change password fail' })
		}
	}

	getAccessToken(req, res) {
		const refreshToken = req.cookies.refreshToken
		// const token = req.headers['cookie'][0].split(';')[0].replace('refreshToken=', '')
		// const refreshToken = req.body.refreshToken

		// console.log(token)

		if (refreshToken == null) return res.sendStatus(401)
		try {
			// verify if this is a refresh token
			const user = verifyToken('refresh', refreshToken)
			console.log(user)
			const { id, fullname, username, avatarUrl } = user
			if (!redis.verifyRefreshToken(id, refreshToken))
				return res
					.status(403)
					.json({ message: 'Invalid refresh token' })
			const accessToken = generateAccessToken({
				id,
				username,
				fullname,
				avatarUrl,
			})
			res.status(200).json(accessToken)
		} catch (err) {
			console.error('Reset token', err)
			res.status(500).json({ error: 'Error' })
		}
	}

	async resetPassword(req, res) {
		try {
			const user = verifyToken('access', req.body.accessToken)

			if (user.otp && req.body.password) {
				// Verify this is a OTP token
				//hash password
				const salt = await bcrypt.genSalt(10)
				const hashPassword = await bcrypt.hash(req.body.password, salt)
				await User.updateOne(
					{ _id: user.id },
					{ $set: { password: hashPassword } }
				)
				res.status(200).json({
					message: 'You have reset your password',
				})
			} else {
				res.status(400).json({
					Error: 'Invalidate token or missing password',
				})
			}
		} catch (err) {
			console.log('Reset password: ', err)
			res.status(500).json({ Error: 'Error' })
		}
	}

	async verifyEmail(req, res) {
		try {
			const user = req.user
			const salt = await bcrypt.genSalt(10)
			bcrypt.hash(user.email, salt).then((hashedEmail) => {
				sendMail(
					user.email,
					'Verify Email',
					`<a href="${process.env.APP_URL}/verify?token=${hashedEmail}"> Verify </a>`
				)
			})
		} catch (error) {
			console.log(err)
			res.status(500).json({ message: 'Error' })
		}
	}
}

module.exports = new AuthController()
