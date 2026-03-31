import React, { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account Created Successfully!");
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1500382017468-9049fed747ef')] bg-cover">
      <div className="bg-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-white border border-white/20">
        <h2 className="text-4xl font-semibold mb-2">Register</h2>
        <p className="text-sm mb-6 opacity-80">Setup your ERP organization account</p>

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full bg-white/5 border border-white/30 rounded-2xl py-3 px-4 outline-none"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-white/5 border border-white/30 rounded-2xl py-3 px-4 outline-none"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-[#059669] py-4 rounded-2xl font-bold text-lg hover:bg-[#047857] transition"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <span
            onClick={() => navigate('/login')}
            className="font-bold cursor-pointer hover:underline"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
};

export default Register;