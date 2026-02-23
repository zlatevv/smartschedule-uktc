package com.zlatev.smartschedule;

import com.zlatev.smartschedule.entity.Grade;
import com.zlatev.smartschedule.entity.Teacher;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

public class Main {
    public static void main(String[] args) {
        EntityManagerFactory emf = Persistence.createEntityManagerFactory("smartschedule-PU");
        EntityManager em = emf.createEntityManager();

        em.getTransaction().begin();

        // 1. Create and save Teachers FIRST (because Grade depends on Teacher)
        Teacher teacher1 = new Teacher("Иван Иванов"); // Assuming your Teacher class takes a name
        em.persist(teacher1);

        // 2. Create and save the Grade using the teacher
        Grade grade9A = new Grade("9A Клас", teacher1);
        em.persist(grade9A);

        // 3. Create and save Subjects (Предмети)
        // Subject math = new Subject("Математика");
        // Subject biology = new Subject("Биология");
        // em.persist(math);
        // em.persist(biology);

        em.getTransaction().commit();

        System.out.println("Data successfully seeded into the database!");

        em.close();
        emf.close();
    }
}