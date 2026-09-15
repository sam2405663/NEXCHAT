import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

const generateUniqueCustomId = async (fullName) => {
  const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "user";
  let unique = false;
  let customId = "";
  let counter = 0;

  while (!unique && counter < 15) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    customId = `@${cleanName}_${randomSuffix}`;
    const existingUser = await User.findOne({ customId });
    if (!existingUser) {
      unique = true;
    }
    counter++;
  }
  return customId;
};

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const customId = await generateUniqueCustomId(fullName);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      customId,
    });

    if (newUser) {
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        customId: newUser.customId,
        createdAt: newUser.createdAt,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.customId) {
      user.customId = await generateUniqueCustomId(user.fullName);
      await user.save();
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      customId: user.customId,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    let imageUrl = profilePic;

    const hasCloudinaryKeys =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME !== "your_cloudinary_cloud_name" &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_KEY !== "your_cloudinary_api_key";

    if (hasCloudinaryKeys) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(profilePic, {
          folder: "nexchat_avatars",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        });
        imageUrl = uploadResponse.secure_url;
      } catch (cloudinaryErr) {
        console.warn("Cloudinary upload failed, using direct image data fallback:", cloudinaryErr.message);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: imageUrl },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    if (req.user && !req.user.customId) {
      const userDoc = await User.findById(req.user._id);
      if (userDoc && !userDoc.customId) {
        userDoc.customId = await generateUniqueCustomId(userDoc.fullName);
        await userDoc.save();
        req.user.customId = userDoc.customId;
      }
    }
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};