import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { User, EyeOff, Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert("Please fill in all fields");

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(error.code);
      if (error.code === 'auth/user-not-found') alert("No account found with this email.");
      else if (error.code === 'auth/wrong-password') alert("Incorrect password.");
      else alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-10 rounded-3xl shadow-2xl w-full max-w-md text-white">
        <h2 className="text-4xl font-bold mb-2 text-center">Login</h2>
        <p className="text-sm mb-8 opacity-80 text-center">Welcome back! Please login to your account</p>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Input */}
          <div className="relative">
            <input
              required
              type="email"
              placeholder="Email Address"
              value={email}
              className="w-full bg-transparent border border-white/40 rounded-xl py-3 px-4 outline-none focus:border-white transition"
              onChange={(e) => setEmail(e.target.value)}
            />
            <User className="absolute right-4 top-3 opacity-60" size={20} />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              className="w-full bg-transparent border border-white/40 rounded-xl py-3 px-4 outline-none focus:border-white transition"
              onChange={(e) => setPassword(e.target.value)}
            />
            <EyeOff className="absolute right-4 top-3 opacity-60" size={20} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="accent-green-500 cursor-pointer" id="remember" />
              <label htmlFor="remember" className="cursor-pointer">Remember me</label>
            </div>
            <span className="hover:underline cursor-pointer opacity-80">Forgot Password?</span>
          </div>

          {/* Submit Button with Loading Spinner */}
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-gradient-to-r from-yellow-500 to-green-500 py-3 rounded-xl font-bold text-lg hover:opacity-90 transition shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          Don't have an account?{' '}
          <span
            onClick={() => navigate('/register')}
            className="font-bold cursor-pointer hover:underline text-yellow-400"
          >
            Signup
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;