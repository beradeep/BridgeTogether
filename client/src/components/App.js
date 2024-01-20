import React, { useEffect, useRef, useState } from 'react';
import '../styles/App.css';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage'; // Add storage import

import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { ReactMic } from 'react-mic'; 

firebase.initializeApp({
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_API_ID,
});

const auth = firebase.auth();
const firestore = firebase.firestore();
const storage = firebase.storage();

function App() {
  const [user] = useAuthState(auth);
  const [click, setClick] = useState(false);
  const [selectedPreference, setSelectedPreference] = useState('');

  const handlePreferenceChange = (event) => {
    const newPreference = event.target.value;
    setSelectedPreference(newPreference);

    // Store the selected preference in local storage
    localStorage.setItem('userPreference', newPreference);
  };

  return (
    <div className="App">
      <header>
        <h1>Chat</h1>
        <SignOut />
        <span className='text-white relative cursor-pointer' onClick={() => setClick(!click)}>
          Preferences
          {click ? (
            <div onClick={(e) => e.stopPropagation()} className='bg-gray-700 flex flex-col gap-4 p-4 w-60 absolute top-6'>
              <select
                className='border-2 border-gray-300 text-black rounded-md p-2'
                value={selectedPreference}
                onChange={handlePreferenceChange}
              >
                <option value='Deafness'>Deafness</option>
                <option value='Color-Blindness'>Color-Blindness</option>
                <option value='Color-Blindness'>Blindness</option>
              </select>
              <button onClick={() => setClick(false)} className='px-6 py-2 bg-red-600 border-rounded'>Close</button>
            </div>
          ) : null}
        </span>
      </header>

      <section>
        {user ? <ChatRoom selectedPreference={selectedPreference} /> : <SignIn />}
      </section>
    </div>
  );
}

function SignIn() {
  const signInWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
  }

  return (
    <>
      <button className="sign-in" onClick={signInWithGoogle}>Sign in with Google</button>
      <p>Do not violate the community guidelines or you will be banned for life!</p>
    </>
  )
}

function SignOut() {
  return auth.currentUser && (
    <button className="sign-out" onClick={() => auth.signOut()}>Sign Out</button>
  )
}

function ChatRoom(props) {
  const dummy = useRef();
  const messagesRef = firestore.collection('messages');
  const query = messagesRef.orderBy('createdAt');
  const [messages] = useCollectionData(query, { idField: 'id' });

  const [formValue, setFormValue] = useState('');
  const [record, setRecord] = useState(false); // State to control recording
  const [blob, setBlob] = useState(null); // State to store recorded audio
  const [image, setImage] = useState(null);

  const onRecordingComplete = (blobObject) => {
    setBlob(blobObject.blob);
  };

  const renderAudio = () => {
    if (blob) {
      const audioUrl = URL.createObjectURL(blob);
      return (
        <div>
          <audio controls>
            <source src={audioUrl} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }
    return null;
  };

  const renderImage = () => {
    if (image) {
      const imageUrl = URL.createObjectURL(image);
      console.log('Image URL:', imageUrl);
  
      return (
        <div>
          <img src={imageUrl} alt="image" style={{ height: '200px', width: '300px', borderRadius: '0' }} />
        </div>
      );
    }
    return null;
  };

  const sendVoiceMessage = async () => {
    console.log("voice uplaod called");
    const { uid, photoURL } = auth.currentUser;

    // Upload audio file to Firebase Storage
    const storageRef = storage.ref();
    const audioRef = storageRef.child(`${uid}/${new Date().toISOString()}.wav`);
    await audioRef.put(blob);

    // Get the URL of the uploaded audio
    const audioURL = await audioRef.getDownloadURL();

    // Add voice message to Firestore
    await messagesRef.add({
      audioURL,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid,
      photoURL,
    });

    setBlob(null);
    dummy.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    setImage(file);
  };

  const handleImageUpload = async () => {
    const { uid, photoURL } = auth.currentUser;
  
    // Upload image to Firebase Storage
    const storageRef = storage.ref();
    const imageRef = storageRef.child(`${uid}/${new Date().toISOString()}.jpg`);
    await imageRef.put(image);
  
    // Get the URL of the uploaded image
    const imageURL = await imageRef.getDownloadURL();
  
    // Add image message to Firestore
    await messagesRef.add({
      imageURL,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid,
      photoURL,
    });
  
    setImage(null); 
    dummy.current.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    // Send text message
    if (formValue.trim() !== '') {
      const { uid, photoURL } = auth.currentUser;
      await messagesRef.add({
        text: formValue,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        uid,
        photoURL,
      });
      setFormValue('');
      dummy.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Send voice message if there is a recorded audio
    if (blob) {
      await sendVoiceMessage();
    }
    if (image){
      await handleImageUpload();
    }
  };

  return (
    <>
      <main>
        {messages && messages.map((msg) => (
          <ChatMessage selectedPreference={props.selectedPreference} key={msg.id} message={msg} />
        ))}
        {renderAudio()}
        {renderImage()}
        <span ref={dummy}></span>
      </main>

      <form onSubmit={sendMessage}>
        <input
          value={formValue}
          onChange={(e) => setFormValue(e.target.value)}
          placeholder="Type a message or record a voice message"
        />

        <ReactMic
          record={record}
          onStop={onRecordingComplete}
          strokeColor="#000000"
          backgroundColor="#FF4081"
        />

        <button type="button" onClick={() => setRecord(!record)}>
          {record ? 'Stop Recording' : 'Start Recording'}
        </button>

        <input type='file' accept="image/*" onChange={handleImageChange}/>

        <button type="submit" disabled={!formValue && !blob && !image}>
          Send
        </button>
      </form>
    </>
  );
}

function ChatMessage(props) {
  const { text, uid, photoURL, audioURL, imageURL } = props.message;
  const { selectedPreference } = props;
  const [responseImage, setResponseImage] = useState(null);
  const messageClass = uid === auth.currentUser.uid ? 'sent' : 'received';

  useEffect(() => {
    if (imageURL && selectedPreference == "Color-Blindness") {
      handleImageUpload();
    }
  }, [selectedPreference]);

  const handleImageUpload = async () => {
    const formData = new FormData();
    formData.append('image', imageURL);
    try {
      const response = await fetch('https://bridge-together-cvcx.vercel.app/simulate-color-blind/deuteranopia', {
        method: 'POST',
        body: formData,
      });
  
      if (response.ok) {
        const responseData = await response.json();
        setResponseImage(responseData.simulatedImageUrl);
      } else {
        console.error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error during image upload:', error);
    }
  };

  return (
    <div className={`message ${messageClass}`}>
      <img src={photoURL || 'https://api.adorable.io/avatars/23/abott@adorable.png'} alt="user" />
      {text && <p>{text}</p>}
      {audioURL && <audio controls src={audioURL}></audio>}
      {imageURL && selectedPreference == "Color-Blindness" && <img src={responseImage} alt="image" style={{ height: '200px', width: '300px', borderRadius: '0' }} />}
      {imageURL && !(selectedPreference === "Color-Blindness") && <img src={imageURL} alt="image" style={{ height: '200px', width: '300px', borderRadius: '0' }} />}
    </div>
  );
}

export default App;
