import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import PhaserGame from "../components/PhaserGame";

const GameplayPage = () => {
  const { id } = useParams();
  const [universe, setUniverse] = useState(null);

  useEffect(() => {
    const fetchUniverse = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`http://localhost:5000/api/universe/${id}`, {
          headers: { Authorization: token },
        });
        setUniverse(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUniverse();
  }, [id]);

  if (!universe) return <div className="text-white p-8">Loading universe...</div>;

  return <PhaserGame universe={universe} />;
};

export default GameplayPage;
