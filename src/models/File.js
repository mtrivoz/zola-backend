const mongoose = require('mongoose')
const cloudinary = require('../configs/cloudinary.config')

const FileSchema = new mongoose.Schema({
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    post_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    public_id: {type: String, default: ""},
    isFromPost: {type: Boolean, default: false},
    isPrivate: {type: Boolean, default: false},
    resource_type: {type: String, default: ""},
    format: {type: String, default: ""},
    url: {type: String, default: ""},
    created_at: {type: Date, default: Date.now()},
    deleted_at: {type: Date, default: null}
})

FileSchema.pre('deleteOne', async function(next) {
    try {
        await cloudinary.uploader.destroy(this.public_id)
        next()
    } catch (error) {
        next(error)
    }
})

const File =  mongoose.model('File', FileSchema)
module.exports = File
