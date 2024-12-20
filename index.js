


const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { type } = require('os');


const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer , {
    cors : {
        origin : '*'
    }
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
mongoose.connect('mongodb+srv://Sujeetgupta986:Sujeetgupta986@cluster0.npbg1.mongodb.net/?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => { 
    console.log('MongoDB connected');
}).catch(err => console.error('MongoDB connection error:', err));

// User Schema


// Product Schema
const productSchema = new mongoose.Schema({
    pname: String,
    pdesc: String,
    price: Number,
    category: String,  
    pimage: {type : String},
    pimage2: {type : String},
    addedBy: mongoose.Schema.Types.ObjectId,

    pLoc: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number]
        }
    }

});



productSchema.index({ pLoc: '2dsphere' });

const Product = mongoose.model('Product', productSchema);



const UserSchema = new mongoose.Schema({
    username: String,
    Mobile: String,
    email: String,
    password: String,
    likedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});
const Users = mongoose.model('Users', UserSchema);


// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });


let message = [];

io.on('connection' , (socket) => {
    console.log("Socket connected", socket.id);

    socket.on('sendMsg' , (data)=> {
     message.push(data);
     io.emit('getMsg', message)

    })

    io.emit('getMsg', message)
    
})







// Signup Route
app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    const email = req.body.email;
    const Mobile = req.body.Mobile;

    const newUser = new Users({ username, password, email, Mobile });
    newUser.save()
        .then(() => res.json({ message: 'Signup Success' }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
});






// Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    Users.findOne({ username })
        .then(result => {
            if (!result) return res.status(404).json({ message: 'User not found' });
            if (result.password === password) {
                const token = jwt.sign({ data: result }, 'MYKEY', { expiresIn: '1h' });
                res.json({ message: 'Success', token, userId: result._id , username : result.username });
            } else {
                res.status(401).json({ message: 'Wrong password' });
            }
        })
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
});

// Add Product Route
app.post("/add-product", upload.fields([{ name: 'pimage' }, { name: 'pimage2' }]), (req, res) => {


    console.log(req.files);
    console.log(req.body);


    const { pname, pdesc, price, category } = req.body;
    const plat = req.body.plat;
    const plong = req.body.plong;
    const pimage = req.files.pimage[0].path;
    const pimage2 = req.files.pimage2[0].path;

    const addedBy = req.body.userId;
    const newProduct = new Product({
        pname, pdesc, price, category, pimage, pimage2, addedBy,
        pLoc: {
            type: 'Point', coordinates: [plat, plong]
        }
    });
    newProduct.save()
        .then(product => res.status(201).json({ message: 'Product added', product }))
        .catch(error => res.status(500).json({ message: 'Error adding product', error }));
});


app.post("/edit-product", upload.fields([{ name: 'pimage' }, { name: 'pimage2' }]), (req, res) => {


    console.log(req.files);
    console.log(req.body);


    const { pname, pdesc, price, category ,  } = req.body;
    const pid = req.body.pid;

    let pimage = '';
    let pimage2 = '';

    if(req.files && req.files.pimage && req.files.pimage.length > 0){
         pimage = req.files.pimage[0].path;

    }
    
    if(req.files && req.files.pimage2 && req.files.pimage2.length > 0){
         pimage2 = req.files.pimage2[0].path;

    }


    // const addedBy = req.body.userId;

    let editObj = {};

    if(pname){
        editObj.pname = pname;
    }
    
    if(pdesc){
        editObj.pdesc = pdesc;
    }
    
    if(price){
        editObj.price = price;
    }
    
    if(category){
        editObj.category = category;
    }
    
    if(pimage){
        editObj.pimage = pimage;
    }
    if(pimage2){
        editObj.pimage2 = pimage2;
    }



    Product.updateOne({ _id : pid }, editObj, {new : true})
 
        .then(product => res.status(201).json({ message: 'Product added', product }))
        .catch(error => res.status(500).json({ message: 'Error adding product', error }));
});



app.get("/get-products", (req, res) => {

    const catName = req.query.catName;

    let _f = {}
    if (catName) {
        _f = { category: catName }
    }


    Product.find(_f)
        .then(products => res.json({ message: 'Success', products }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
});


app.post("/delete-product", (req, res) => {

    console.log(req.body);
    
Product.findOne({_id : req.body.pid})
.then((result) => {

if(result.addedBy == req.body.userId){
    Product.deleteOne({_id : req.body.pid})
    .then((deleteresult) => {
        if(deleteresult.acknowledged){
            res.send({ message: 'Success' })

        }

    })
    .catch((err) => {
        res.send({ message: 'Server error' })
    });



}

})
.catch((err) => {
    res.send({ message: 'Server error' })
});


});



// Get Single Product Route
app.get("/get-product/:pId", (req, res) => {
    Product.findById( req.params.pId)
        .then(product => res.json({ message: 'Success', product }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
});







// Like Product Route
app.post('/like-products', (req, res) => {
    const { productId, userId } = req.body;
    Users.updateOne({ _id: userId }, { $addToSet: { likedProducts: productId } })
        .then(() => res.json({ message: 'Like Saved' }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
});

app.post('/dislike-products', (req, res) => {
    const { productId, userId } = req.body;
    Users.updateOne({ _id: userId }, { $pull: { likedProducts: productId } })
        .then(() => res.json({ message: 'Dislike Saved' }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
});



app.get('/search', (req, res) => {

    console.log(req.query)

    let latitude = req.query.loc.split(',')[0]
    let longitude = req.query.loc.split(',')[1]

    let search = req.query.search;
    Product.find({
        $or: [
            { pname: { $regex: search } },
            { pdesc: { $regex: search } },
            { price: { $regex: search } },
        ],
        pLoc: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)]
                },
                $maxDistance: 500 * 1000,
            }

        }
    })
        .then((results) => {
            res.send({ message: 'success', products: results })
        })
        .catch((err) => {
            res.send({ message: 'server err' })
        })


});







// Test Route
app.get('/', (req, res) => res.send('Hello World'));

// Start server
const port = 4000;
httpServer.listen(port, () => console.log(`Server is running on port ${port}`));



app.get('/my-profile/:userId', (req, res) => {

    let uid = req.params.userId;

    Users.findOne({ _id: uid })
        .then((result) => res.json({
            message: 'Success', user: {
                email: result.email,
                Mobile: result.Mobile,
                username: result.username
            }
        }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));

})


app.get('/get-user/:uId', (req, res) => {
    const _userId = req.params.uId;
    Users.findOne({ _id: _userId })
        .then((result) => res.json({
            message: 'Success', user: {
                email: result.email,
                Mobile: result.Mobile,
                username: result.username
            }
        }))
        .catch(err => res.status(500).json({ message: 'Server Error', error: err }));
})




app.post('/Liked-products', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).send({ message: 'User ID is required' });
    }

    try {
        console.log("Fetching liked products for user ID:", userId);
        const user = await Users.findOne({ _id: userId }).populate('likedProducts');

        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        res.send({ message: 'Success', products: user.likedProducts || [] });
    } catch (error) {
        console.error("Error fetching liked products:", error.message);
        res.status(500).send({ message: 'Server error', error: error.message });
    }
});






app.post('/my-products', (req, res) => {

    const userId = req.body.userId;

    Product.find({ addedBy: userId })
        .then((result) => {
            res.send({ message: 'Success', products: result })
        })
        .catch((err) => {
            res.send({ message: 'Server error' })
        });
})










