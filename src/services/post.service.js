const Post = require('../models/Post')

const getRecommendPost = async (userId) => {
	try {
		// get last five post that user liked
		const lastFivePost = await Post.find({
			like_by: userId,
		})

		// get author of last five post
		const author = lastFivePost.map((post) => post.author)

		// get the category of last five post
		const category = lastFivePost.map((post) => post.category_by_ai)

		// recommend post by author and category
		const recommendPost = await Post.aggregate([
            {
              $match: {
                category_by_ai: { $in: category },
                author: { $in: author },
                deleted_at: null,
                like_by: { $ne: userId },
              },
            },
            {
              $addFields: {
                totalLike: { $size: "$like_by" },
                totalComment: { $size: "$comments" },
                isLike: { $in: [userId, "$like_by"] },
              },
            },
            {
              $sort: {
                totalLike: -1,
                totalComment: -1,
                created_at: -1,
              },
            },
            {
              $limit: 15,
            },
            {
              $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "authorInfo",
              },
            },
            {
              $lookup: {
                from: "files",
                localField: "attach_files",
                foreignField: "_id",
                as: "attachments",
              },
            },
            {
                $project: {
                  "author.username": { $arrayElemAt: ["$authorInfo.username", 0] },
                  "author.fullname": { $arrayElemAt: ["$authorInfo.fullname", 0] },
                  "author.avatar": { $arrayElemAt: ["$authorInfo.avatar", 0] },
                  "author.contact_info": { $arrayElemAt: ["$authorInfo.contact_info", 0] },
                  attach_files: {
                    $map: {
                      input: "$attachments",
                      as: "file",
                      in: {
                        id: "$$file._id",
                        url: "$$file.url",
                        resource_type: "$$file.resource_type",
                      },
                    },
                  },
                  title: 1,
                  content: 1,
                  created_at: 1,
                  isLike: 1,
                  totalLike: 1,
                  totalComment: 1,

                },
            }
          ]);
        // await Post.find({
		// 	category_by_ai: { $in: category },
		// 	author: { $in: author },
		// 	deleted_at: null,
		// 	like_by: { $ne: userId },
		// })
		// 	.sort({ created_at: -1 })
		// 	.limit(15)
		// 	.populate('author', 'username fullname avatarUrl')
		// 	.populate('attach_files', 'resource_type format url')

		return recommendPost
	} catch (error) {
		console.log('Error: ', error)
		return []
	}
}

module.exports = { getRecommendPost }