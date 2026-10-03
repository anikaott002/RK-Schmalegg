import React, { useState, useEffect } from 'react';
import TimeSlotForm from './TimeSlotForm';
import './EventForm.css';

const EventForm = ({ event, onSave, onCancel, isEditing = false, availableCategories = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dateFrom: '',
    dateTo: '',
    location: ''
  });

  const [timeSlots, setTimeSlots] = useState([]);

  // === CATEGORY UPDATE START: EVENT CATEGORIES ===
  const [categories, setCategories] = useState([]);
  const [selectedExistingCategory, setSelectedExistingCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  // === CATEGORY UPDATE END: EVENT CATEGORIES ===

  const [errors, setErrors] = useState({});
  const [showTimeSlotForm, setShowTimeSlotForm] = useState(false);
  const [editingTimeSlotIndex, setEditingTimeSlotIndex] = useState(null);

  // Initialize form data when editing
  useEffect(() => {
    if (isEditing && event) {
      setFormData({
        name: event.name || '',
        description: event.description || '',
        dateFrom: event.dateFrom || '',
        dateTo: event.dateTo || '',
        location: event.location || ''
      });
      
      // Load existing time slots
      const existingTimeSlots = event.timeSlots || [];
      setTimeSlots(existingTimeSlots);

      // === CATEGORY UPDATE START: LOAD EVENT CATEGORIES ===
      // Backwards compatible: old events may only have categories on their time slots.
      const loadedCategories = [...new Set([
        ...(Array.isArray(event.categories) ? event.categories : []),
        ...existingTimeSlots.map(slot => slot.category),
      ]
        .map(category => String(category || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

      setCategories(loadedCategories);
      // === CATEGORY UPDATE END: LOAD EVENT CATEGORIES ===
    }
  }, [isEditing, event]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };


  // === CATEGORY UPDATE START: ADD / REMOVE CATEGORIES ===
  const addCategory = (rawCategory) => {
    const value = String(rawCategory || '').trim();
    if (!value) return;

    const alreadyExists = categories.some(
      category => category.toLocaleLowerCase('de') === value.toLocaleLowerCase('de')
    );

    if (!alreadyExists) {
      setCategories(prev => [...prev, value].sort((a, b) => a.localeCompare(b, 'de')));
    }

    setSelectedExistingCategory('');
    setNewCategory('');
    setErrors(prev => ({ ...prev, categories: '' }));
  };

  const removeCategory = (categoryToRemove) => {
    const categoryIsUsed = timeSlots.some(
      slot => String(slot.category || '').trim() === categoryToRemove
    );

    if (categoryIsUsed) {
      setErrors(prev => ({
        ...prev,
        categories: `Die Kategorie „${categoryToRemove}“ wird noch von einem Zeitslot verwendet. Entferne oder ändere zuerst diesen Zeitslot.`
      }));
      return;
    }

    setCategories(prev => prev.filter(category => category !== categoryToRemove));
    setErrors(prev => ({ ...prev, categories: '' }));
  };

  const reusableCategories = availableCategories.filter(
    option => !categories.some(
      category => category.toLocaleLowerCase('de') === String(option).toLocaleLowerCase('de')
    )
  );
  // === CATEGORY UPDATE END: ADD / REMOVE CATEGORIES ===

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name ist erforderlich';
    if (!formData.description.trim()) newErrors.description = 'Beschreibung ist erforderlich';
    if (!formData.dateFrom) newErrors.dateFrom = 'Startdatum ist erforderlich';
    if (!formData.location.trim()) newErrors.location = 'Ort ist erforderlich';

    // === CATEGORY UPDATE START: REQUIRED CATEGORY VALIDATION ===
    if (categories.length === 0) {
      newErrors.categories = 'Mindestens eine Kategorie ist erforderlich';
    }

    timeSlots.forEach((timeSlot, index) => {
      const category = String(timeSlot.category || '').trim();
      if (!category) {
        newErrors[`timeSlot_${index}_category`] = 'Kategorie ist erforderlich';
      } else if (!categories.includes(category)) {
        newErrors[`timeSlot_${index}_category`] = `Die Kategorie „${category}“ ist dem Event nicht zugeordnet`;
      }
    });
    // === CATEGORY UPDATE END: REQUIRED CATEGORY VALIDATION ===

    // If dateTo is not provided, use dateFrom
    if (!formData.dateTo) {
      setFormData(prev => ({
        ...prev,
        dateTo: prev.dateFrom
      }));
    }

    // Validate date range
    const startDate = new Date(formData.dateFrom);
    const endDate = new Date(formData.dateTo || formData.dateFrom);
    
    if (endDate < startDate) {
      newErrors.dateTo = 'Enddatum muss nach dem Startdatum liegen';
    }

    // Validate time slots
    timeSlots.forEach((timeSlot, index) => {
      const slotPrefix = `timeSlot_${index}`;
      
      if (!timeSlot.name || !timeSlot.name.trim()) {
        newErrors[`${slotPrefix}_name`] = 'Zeitslot Name ist erforderlich';
      }
      
      if (!timeSlot.timeFrom) {
        newErrors[`${slotPrefix}_timeFrom`] = 'Startzeit ist erforderlich';
      }
      
      if (!timeSlot.timeTo) {
        newErrors[`${slotPrefix}_timeTo`] = 'Endzeit ist erforderlich';
      }
      
      if (!timeSlot.maxParticipants || timeSlot.maxParticipants < 1) {
        newErrors[`${slotPrefix}_maxParticipants`] = 'Mindestens 1 Teilnehmer erforderlich';
      }
      
      // Validate time slot time range
      if (timeSlot.timeFrom && timeSlot.timeTo) {
        const [slotFromHour, slotFromMin] = timeSlot.timeFrom.split(':').map(Number);
        const [slotToHour, slotToMin] = timeSlot.timeTo.split(':').map(Number);
        
        const slotFromMinutes = slotFromHour * 60 + slotFromMin;
        const slotToMinutes = slotToHour * 60 + slotToMin;
        
        if (slotToMinutes <= slotFromMinutes) {
          newErrors[`${slotPrefix}_timeTo`] = 'Endzeit muss nach der Startzeit liegen';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Time Slot Management Functions
  const handleAddTimeSlots = (newTimeSlots) => {
    if (Array.isArray(newTimeSlots)) {
      // Multiple timeslots
      const slotsWithIds = newTimeSlots.map(slot => ({
        ...slot,
        id: Date.now() + Math.random()
      }));
      setTimeSlots([...timeSlots, ...slotsWithIds]);
    } else {
      // Single timeslot
      const slotWithId = {
        ...newTimeSlots,
        id: Date.now()
      };
      setTimeSlots([...timeSlots, slotWithId]);
    }
    setShowTimeSlotForm(false);
  };

  const handleEditTimeSlot = (index) => {
    setEditingTimeSlotIndex(index);
    setShowTimeSlotForm(true);
  };

  const handleUpdateTimeSlot = (updatedSlot) => {
    const updatedTimeSlots = [...timeSlots];
    updatedTimeSlots[editingTimeSlotIndex] = {
      ...updatedTimeSlots[editingTimeSlotIndex],
      ...updatedSlot
    };
    setTimeSlots(updatedTimeSlots);
    setShowTimeSlotForm(false);
    setEditingTimeSlotIndex(null);
  };

  const handleCancelTimeSlotForm = () => {
    setShowTimeSlotForm(false);
    setEditingTimeSlotIndex(null);
  };

  const removeTimeSlot = (index) => {
    const updatedTimeSlots = timeSlots.filter((_, i) => i !== index);
    setTimeSlots(updatedTimeSlots);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('EventForm: handleSubmit called');
    console.log('EventForm: Form data:', formData);
    console.log('EventForm: Time slots:', timeSlots);
    
    if (validateForm()) {
      // Remove temporary IDs from new timeslots (those with decimal point IDs)
      const cleanedTimeSlots = timeSlots.map(slot => {
        const { id, ...slotData } = slot;
        // Only keep ID if it's an integer (existing slot from backend)
        if (Number.isInteger(id)) {
          return slot;
        }
        // Remove temporary ID for new slots
        return slotData;
      });
      
      const eventData = {
        ...formData,
        dateTo: formData.dateTo || formData.dateFrom,
        // === CATEGORY UPDATE START: SAVE EVENT CATEGORIES ===
        categories,
        // === CATEGORY UPDATE END: SAVE EVENT CATEGORIES ===
        timeSlots: cleanedTimeSlots,
        // Preserve existing participants when editing, start with empty array when creating
        participants: isEditing ? (event.participants || []) : [],
        // Default to draft status when creating, preserve existing when editing
        status: isEditing ? (event.status || 'draft') : 'draft'
      };
      console.log('EventForm: Validation passed, calling onSave with:', eventData);
      onSave(eventData);
    } else {
      console.log('EventForm: Validation failed, errors:', errors);
    }
  };

  const handleSaveAs = (status) => {
    if (validateForm()) {
      // Remove temporary IDs from new timeslots
      const cleanedTimeSlots = timeSlots.map(slot => {
        const { id, ...slotData } = slot;
        if (Number.isInteger(id)) {
          return slot;
        }
        return slotData;
      });
      
      const eventData = {
        ...formData,
        dateTo: formData.dateTo || formData.dateFrom,
        // === CATEGORY UPDATE START: SAVE EVENT CATEGORIES ===
        categories,
        // === CATEGORY UPDATE END: SAVE EVENT CATEGORIES ===
        timeSlots: cleanedTimeSlots,
        participants: isEditing ? (event.participants || []) : [],
        status: status
      };
      onSave(eventData, status);
    }
  };

  return (
    <div className="event-form-page">
      <div className="event-form-header">
        <button className="back-button" onClick={onCancel}>
          ← Zurück zum Event
        </button>
        <h2>{isEditing ? 'Event bearbeiten' : 'Neues Event erstellen'}</h2>
      </div>

      <form className="event-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Event Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={errors.name ? 'error' : ''}
            placeholder="z.B. Reitturnier Frühjahr"
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Beschreibung *</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className={errors.description ? 'error' : ''}
            placeholder="Detaillierte Beschreibung des Events..."
            rows="3"
          />
          {errors.description && <span className="error-text">{errors.description}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="dateFrom">Startdatum *</label>
            <input
              type="date"
              id="dateFrom"
              name="dateFrom"
              value={formData.dateFrom}
              onChange={handleChange}
              className={errors.dateFrom ? 'error' : ''}
            />
            {errors.dateFrom && <span className="error-text">{errors.dateFrom}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="dateTo">Enddatum</label>
            <input
              type="date"
              id="dateTo"
              name="dateTo"
              value={formData.dateTo}
              onChange={handleChange}
              placeholder="Optional (falls mehrtägig)"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="location">Ort *</label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className={errors.location ? 'error' : ''}
            placeholder="z.B. Reitanlage RK Schmalegg"
          />
          {errors.location && <span className="error-text">{errors.location}</span>}
        </div>

        {/* === CATEGORY UPDATE START: EVENT CATEGORY MANAGEMENT === */}
        <div className="categories-section">
          <div className="categories-header">
            <div>
              <h3>Kategorien *</h3>
              <p>Mindestens eine Kategorie ist erforderlich. Du kannst eine bereits verwendete Kategorie übernehmen oder eine neue anlegen.</p>
            </div>
          </div>

          <div className="category-controls">
            <div className="category-control-row">
              <select
                value={selectedExistingCategory}
                onChange={(e) => setSelectedExistingCategory(e.target.value)}
                disabled={reusableCategories.length === 0}
              >
                <option value="">
                  {reusableCategories.length > 0 ? 'Vorhandene Kategorie auswählen' : 'Keine weiteren vorhandenen Kategorien'}
                </option>
                {reusableCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button
                type="button"
                className="category-add-button"
                onClick={() => addCategory(selectedExistingCategory)}
                disabled={!selectedExistingCategory}
              >
                Übernehmen
              </button>
            </div>

            <div className="category-divider"><span>oder</span></div>

            <div className="category-control-row">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory(newCategory);
                  }
                }}
                placeholder="Neue Kategorie, z.B. Aufbau"
                maxLength={80}
              />
              <button
                type="button"
                className="category-add-button"
                onClick={() => addCategory(newCategory)}
                disabled={!newCategory.trim()}
              >
                + Neue Kategorie
              </button>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="category-chips">
              {categories.map(category => (
                <span className="category-chip" key={category}>
                  {category}
                  <button
                    type="button"
                    onClick={() => removeCategory(category)}
                    aria-label={`Kategorie ${category} entfernen`}
                    title="Kategorie entfernen"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {errors.categories && <span className="error-text">{errors.categories}</span>}
        </div>
        {/* === CATEGORY UPDATE END: EVENT CATEGORY MANAGEMENT === */}

        {/* Zeitslots Section */}
        <div className="timeslots-section">
          <div className="timeslots-header">
            <h3>Zeitslots (Optional)</h3>
            <button 
              type="button" 
              className="add-timeslot-button"
              onClick={() => setShowTimeSlotForm(true)}
              disabled={categories.length === 0}
              title={categories.length === 0 ? 'Lege zuerst mindestens eine Kategorie an' : 'Zeitslot hinzufügen'}
            >
              + Zeitslot hinzufügen
            </button>
          </div>
          
          {timeSlots.length > 0 && (
            <div className="timeslots-list">
              {timeSlots.map((timeSlot, index) => (
                <div key={timeSlot.id || index} className="timeslot-item">
                  <div className="timeslot-info">
                    <div className="timeslot-detail">
                      {timeSlot.category && <span className="timeslot-category">{timeSlot.category}</span>}
                      <strong>{timeSlot.name}</strong>
                    </div>
                    <div className="timeslot-time">
                      {timeSlot.timeFrom} - {timeSlot.timeTo}
                    </div>
                    <div className="timeslot-capacity">
                      Max: {timeSlot.maxParticipants} Teilnehmer
                    </div>
                    {errors[`timeSlot_${index}_category`] && (
                      <span className="error-text">{errors[`timeSlot_${index}_category`]}</span>
                    )}
                  </div>
                  <div className="timeslot-actions">
                    <button 
                      type="button" 
                      className="edit-timeslot-button"
                      onClick={() => handleEditTimeSlot(index)}
                      title="Zeitslot bearbeiten"
                    >
                      ✎
                    </button>
                    <button 
                      type="button" 
                      className="remove-timeslot-button"
                      onClick={() => removeTimeSlot(index)}
                      title="Zeitslot entfernen"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {timeSlots.length === 0 && (
            <p className="no-timeslots-hint">
              Keine Zeitslots definiert. Fügen Sie welche hinzu, um das Event in spezifische Zeitbereiche aufzuteilen.
            </p>
          )}
        </div>

        {/* TimeSlot Form Modal */}
        {showTimeSlotForm && (
          <div className="modal-overlay" onClick={handleCancelTimeSlotForm}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <TimeSlotForm
                onSave={editingTimeSlotIndex !== null ? handleUpdateTimeSlot : handleAddTimeSlots}
                onCancel={handleCancelTimeSlotForm}
                timeSlot={editingTimeSlotIndex !== null ? timeSlots[editingTimeSlotIndex] : null}
                isEditing={editingTimeSlotIndex !== null}
                event={formData.dateFrom ? {
                  dateFrom: formData.dateFrom,
                  dateTo: formData.dateTo || formData.dateFrom,
                } : null}
                existingCategories={categories}
              />
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Abbrechen
          </button>
          <div className="save-buttons">
            <button 
              type="button" 
              className="draft-button"
              onClick={() => handleSaveAs('draft')}
            >
              {isEditing ? 'Als Entwurf speichern' : 'Als Entwurf speichern'}
            </button>
            <button 
              type="button" 
              className="publish-button"
              onClick={() => handleSaveAs('published')}
            >
              {isEditing ? 'Veröffentlichen' : 'Veröffentlichen'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EventForm;
