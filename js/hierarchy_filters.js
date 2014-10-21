/**
 * Hierarchy filter widget
 * Type:
     * type == 1  => single choice
     * type == 2  => multi choice
     * type == 3  => single choice only leaf
     * type == 4  => multi choice only leaf
 */

$.widget('custom.hierarchyFilter', {
    options: {
        type: 2,
        selected: [],
        url: '',
        data: [],
        disabled: false,
        placeholder: "Select something...",
        label: "Selected elements",
        /*simlified == w/o buttons*/
        simplified: false,
        /*show or hide 'deleted' scheckbox*/
        show_checkbox_hide_deleted: false
    },

    _create: function () {
        var self = this;
        var type = this.options.type;
		if (!self.options.simplified) {
        	self.$jstree = $('<div class="jstree bs_block' + ' treetype_' + type + '"></div>');
        } else {
			self.$jstree = $('<div class="jstree bs_block simplified' + ' treetype_' + type + '"></div>');
		}
		self.$jstree_hidden_input = self.element;
        self.$jstree_input = $('<input type="text" class="jstree_input input">');

		if (!self.options.simplified) {
			self.$jstree_hidden_input.wrap($('<div class="standard-field jstree-field"></div>'));
		} else {
			self.$jstree_hidden_input.wrap($('<div class="standard-field jstree-field simplified"></div>'));
		}
        self.$jstree_input_wrapper = self.$jstree_hidden_input.parent();

        self.$jstree_hidden_input.before(self.$jstree_input);

        var toggle_deleted_block = '';
        if (self.options.show_checkbox_hide_deleted) {
            toggle_deleted_block = '<div class="action_toggle_deleted">Hide deleted</div>';
            self.$jstree.addClass('show_checkbox_hide_deleted');
        }

		if (!self.options.simplified) {
        	self.$buttons = $('<div class="jstree_buttons">' +
            '<div class="action_approve standard-button"><div class="button-text">Accept</div></div>' +
            '<div class="action_cancel standard-button"><div class="button-text">Cancel</div></div>' +
            '<div class="action_clear standard-button"><div class="button-text">Clear</div></div>' +
            '<div class="clear"></div>' +
            toggle_deleted_block +
            '</div>');
		}

        function set_selected_from_hidden_input() {
            var selected = self.$jstree_hidden_input.val();
            selected = selected.replace(/[\[\]']+/g,'');
            self.options.selected = selected.split(/, ?/);
        }

        set_selected_from_hidden_input();

        var old_result = [];
        var isSingleChoice = (type == 1 || type == 3);

		function set_placeholder() {
			self.$jstree_input.val("");

			if (old_result.length > 0) {
				if (isSingleChoice) {
					var name = self.get_selected_name();
					self.$jstree_input.attr('placeholder', name).addClass('bold_text');
				} else {
					self.$jstree_input.attr('placeholder', self.options.label);
				}
				self.$jstree_input_wrapper.addClass('hierarchy_filter_checked');
			} else {
				if (isSingleChoice) {
					self.$jstree_input.attr('placeholder', self.options.placeholder).removeClass('bold_text');
				} else {
					self.$jstree_input.attr('placeholder', self.options.placeholder);
				}
				self.$jstree_input_wrapper.removeClass('hierarchy_filter_checked');
			}
		}

		/*data loading methods*/
		self.load_json = function($args) {
			if ($args && $args.source.length != 0) {
				$.getJSON($args.source , $args.param,  function(data) {
                    if (data.length != 0) {
                        self.init(data, $args.selected);
                    } else {
                        clear_data();
                    }
				});
			}
        };

		self.update_json = function($args) {
			if ($args && $args.source.length != 0) {
                $.onceAjax({
                    type: "GET",
                    url : $args.source,
                    data: $args.param,
                    contentType: "application/json",
                    syncObj: $args.object,
                    success: function(data) {
                        if (data.length != 0) {
                            update_jstree_data(data);
                        } else {
                            clear_data();
                        }
                    },
                    complete: function() {
                        if ($args.afterChange != null && typeof $args.afterChange == "function") {
                            $args.afterChange();
                        } else {
                            $args.object.change();
                        }
                    }
                });
			}
        };

		self.load_data = function(data, $selectedNodeId) {
			if (data.length > 0) {
				self.init(data, $selectedNodeId);
			} else {
                clear_data();
            }
        };

		self.update_data = function(data) {
			if (data.length > 0) {
				update_jstree_data(data);
			} else {
                clear_data();
            }
        };

        function clear_data() {
            self.$jstree_hidden_input.val("");
            self.$jstree.empty();
            self.$jstree.jstree("refresh");
            self.clear();
        }

		function update_jstree_data(data){
           self.$jstree.jstree(true).settings.core.data = data;
           self.$jstree.jstree("refresh");
           add_tree_to_container();
           open_and_scroll_tree();
       }

        function split_deleted_and_not_clickable(selected) {
            var disabled_nodes = [];
            $.each(self.$jstree.jstree("get_top_selected"), function(index, value) {
                var $el = self.$jstree.find('li#' + value);
                if (
                    isDeleted($el) ||
                        isNotClickable($el)
                    ) {
                    disabled_nodes.push(value);
                } else {
                    selected.push(value);
                }
            });
            $.each(disabled_nodes, function(index, value) {
                var $children_of_current_disabled_node = self.$jstree.jstree(true).get_children_dom(value);
                $children_of_current_disabled_node.each(function() {
                    selected.push($(this).attr('id'));
                });
            });
        }

        /** data handling methods */
        self.get_selected = function() {
            var selected = [];
            split_deleted_and_not_clickable(selected);
            if (selected == '') return [];
            return selected;
        };

        self.select = function(ids) {
            var generic_id_array = ids.split(",");
            if (isSingleChoice && generic_id_array.length > 1) {
                console.error('ERROR: trying to select more than one option while operating SINGLE type filter. First of the given options selected.');
                self.destroy();
            } else {
                self.$jstree.jstree(true).deselect_all(true);
                self.$jstree.jstree(true).select_node(generic_id_array);
                self.accept();
            }
        };

		self.disable = function () {
			self.options.disabled = true;
            self.$jstree_input.attr('disabled', true);
            self.$jstree_input_wrapper.addClass('jstree-disabled-input');
			self.$jstree.addClass('jstree-disabled');
		};

		self.enable = function () {
			self.options.disabled = false;
            self.$jstree_input.attr('disabled', false);
			self.$jstree.jstree(true).select_node(this.options.selected);
            self.$jstree_input_wrapper.removeClass('jstree-disabled-input');
			self.$jstree.removeClass('jstree-disabled');
		};

        self.clear = function() {
            old_result = [];

            self.$jstree_hidden_input.val("");

            self.$jstree.jstree("deselect_all", true);
            self.$jstree.jstree("refresh");

            self.$jstree.find('li').each(function() {
                self.$jstree.jstree("enable_node", $(this).attr('id'));
            });

            self.$jstree.jstree(true).clear_search();
            self.$jstree_input.change();
            self.accept();

            if (!self.options.simplified) {
                self.$buttons.clone().appendTo(self.$jstree);
            }

            set_placeholder();
        };

        self.cancel = function() {
            if (old_result.length == 0) {
                self.clear();
                return;
            }

            if (isSingleChoice) {
                self.$jstree.find('li').each(function() {
                    self.$jstree.jstree("enable_node", $(this).attr('id'));
                });
            }

            self.$jstree.jstree("deselect_all", true);

            set_selected_from_hidden_input();

            $.each(self.options.selected, function(index, value) {
                self.$jstree.jstree(true).select_node(value, true);
            });

            self.$jstree.jstree("refresh");
            if (!self.options.simplified) {
                self.$buttons.clone().appendTo(self.$jstree);
            }
        };

        self.accept = function() {
            old_result = self.get_selected();
            self.options.selected = old_result;
            self.$jstree.jstree(true).clear_search();
            self.$jstree_input.change();
            self.$jstree_hidden_input.val(old_result);
            self.$jstree_hidden_input.change();
            set_placeholder();
            open_and_scroll_tree();
        };

		/** tree handling methods */
        self.open_tree = function() {
            if (!self.options.disabled) {
                if (!self.options.simplified && self.$jstree.css('top') == 'auto') {
                    self.$jstree.css('top', self.$jstree_input.offset().top + 22 + 'px');
                    self.$jstree.css('left', self.$jstree_input.offset().left - 5 + 'px');
                }
                self.$jstree.addClass('active');
                self.place_buttons();
            }
        };

        self.close_tree = function() {
            self.$jstree.removeClass('active');
        };

        self.place_buttons = function() {
            self.$jstree.find('.jstree_buttons').css('top', self.$jstree.scrollTop() + 'px');
        };

        self.get_selected_name = function() {
            if (!isSingleChoice) return "";

            var selectedIdArray = self.get_selected();
            if (selectedIdArray.length == 0) return "";

            var name = self.$jstree.jstree(true).get_text(self.$jstree.jstree(true).get_node(selectedIdArray[0]));
            //screening
            return $("<div>").html(name).text();
        };

        /** check type */
        if (isSingleChoice) {
            self.is_leaf = function() {
                return self.$jstree.jstree(true).is_leaf(self.options.selected) && self.get_selected().length > 0;
            };

            self.is_node = function() {
                return !self.is_leaf() && !self.is_root();
            };

            self.is_root = function() {
                return self.$jstree.jstree(true).get_path(self.options.selected).length == 1;
            };
        }

        /**INIT METHODS*/
        self.init = function(data, $selectedNodeId) {
            self.draw_tree(data, $selectedNodeId);
            self.bind_events();
        };

        function open_and_scroll_tree() {
            function scroll_opened_tree(id) {
                self.open_tree();
                var scrollheight = self.$jstree.find('li#' + id).offset().top - self.$jstree.offset().top;
                if (scrollheight > 50 ) {
                    self.$jstree.scrollTop(scrollheight - 50);
                }
                self.close_tree();
            }

            /**open the tree and scroll it */
            if (old_result.length == 0) {
                self.$jstree.jstree("open_node", self.$jstree.find('li.jstree-last').attr('id'));
            } else {
                if (isSingleChoice) {
                    self.$jstree.jstree("open_node", self.get_selected());
                    scroll_opened_tree(self.get_selected());
                } else {
                    $.each(self.options.selected, function(index, value) {
                        self.$jstree.jstree(true).open_node(value);
                        if (index == 0) {
                            scroll_opened_tree(value);
                        }
                    });
                }
            }
        };

		self.draw_tree = function(data, $selectedNodeId) {

                var three_state = !isSingleChoice;

				self.$jstree.jstree({
					"core" : {
						'data' :  data
					},
					"checkbox" : {
						"keep_selected_style" : false,
                        "three_state" : three_state
					},
					"search" : {
						"case_insensitive" : true,
						"show_only_matches" : true,
						"fuzzy" : false
					},
					"plugins" : [ "checkbox", "search", "sort" ]
				});

				add_tree_to_container();
                if (self.options.disabled) {
                    self.disable();
                }

                /**find and disable deleted elements*/
                var nodes_to_disable = get_deleted_nodes();
                nodes_to_disable.each(function() {
                    self.$jstree.jstree("disable_node", $(this).attr('id'));
                });

                /**choose loaded nodes*/
                $($selectedNodeId).each(function(index, id){
                    self.$jstree.jstree(true).select_node(id, true);
                });
                old_result = self.get_selected();

                /**if there ARE nodes, then write them down in hidden input*/
                if (self.options.selected.length > 0) {
                    self.$jstree_hidden_input.val(self.options.selected);
                }

                open_and_scroll_tree();

                set_placeholder();

                sessionStorage.getItem(window.location.pathname + '?is_jstree_hidden_deleted') === 'true'
                && self.$jstree.addClass('jstree_hidden_deleted');

		}; // self.draw_tree
		
		function add_tree_to_container(){
            if (!self.options.simplified) {
                /**if not simplified -- set it before body closing */
                $('body').append(self.$jstree);
                /**add buttons, if not simplified*/
                self.$buttons.clone().appendTo(self.$jstree);
            } else {
                self.$jstree_hidden_input.parent().after(self.$jstree);
            }
        }

        self.bind_events = function () {
            add_class_disabled_if_disabled()

            if (!self.options.simplified) {
                open_tree_on_focus();

                bind_button_events();

                bind_document_events();
            }

            bind_autocomplete_search();

            /*TYPE-dependant INIT*/
            bind_jstree_events();

            set_placeholder();
            /*Events INIT ends*/
        };

            function open_tree_on_focus() {
                self.$jstree_input.on('focus', function () {
                    self.open_tree();
                });
            }

            function add_class_disabled_if_disabled() {
                if (self.options.disabled) {
                    self.$jstree.addClass('jstree-disabled');
                }
            }

            function bind_jstree_events() {
                if (isSingleChoice) {
                    bind_single_jstree_events();
                } else {
                    bind_multiple_jstree_events();
                }

                toggle_disabled_and_deleted_on_node_open();
            }

                function toggle_disabled_and_deleted_on_node_open() {
                    self.$jstree.on("open_node.jstree", function (e, data) {
                        /*find and disable deleted*/
                        self.$jstree.find('li#' + data.node.id + ' li').each(function() {
                            if (isDeleted($(this))) {
                                self.$jstree.jstree("disable_node", $(this).attr('id'));
                            }
                        });
                    });
                }

                function bind_multiple_jstree_events() {

                    self.$jstree.on("changed.jstree", function (e, data) {
                        var action = data.action;
                        var chosen_node_id;

                        if (action == 'select_node') {
                            chosen_node_id = data.node.id;
                            var $chosen_li = self.$jstree.find('li#' + chosen_node_id);

                            if 	(!self.$jstree.jstree("is_leaf", chosen_node_id) && type == 4 ||
                                isNotClickable($chosen_li) ||
                                isDeleted($chosen_li) ||
                                self.options.disabled)
                            {
                                e.stopImmediatePropagation();
                                self.$jstree.jstree(true).deselect_node(chosen_node_id, true);
                            }
                        }

                        if (action == 'deselect_node') {
                            chosen_node_id = data.node.id;
                            var $chosen_li = self.$jstree.find('li#' + chosen_node_id);

                            if (!self.$jstree.jstree("is_leaf", chosen_node_id) && type == 4 ||
                                isNotClickable($chosen_li) ||
                                isDeleted($chosen_li) ||
                                self.options.disabled) {
                                    chosen_node_id = data.node.id;
                                    e.stopImmediatePropagation();
                                    self.$jstree.jstree(true).select_node(chosen_node_id, true);
                            }
                        }

                        if (self.options.simplified) {
                            set_placeholder();
                        }
                    });

                }

                function bind_single_jstree_events() {
                    self.$jstree.on("changed.jstree", function (e, data) {
                        var action = data.action;

                        self.$jstree.removeClass('selection_only_child');

                        if (data.node != undefined) {
                            var chosen_node_id = data.node.id;

                            if (action == 'select_node') {
                                var $chosen_li = self.$jstree.find('li#' + chosen_node_id);
                                if  (!self.$jstree.jstree("is_leaf", chosen_node_id) && type == 3 ||
                                    isNotClickable($chosen_li) ||
                                    isDeleted($chosen_li) ||
                                    self.options.disabled)
                                {
                                    e.stopImmediatePropagation();
                                    self.$jstree.jstree(true).deselect_node(chosen_node_id, true);
                                    return;
                                }
                                self.$jstree.jstree(true).deselect_all(true);
                                self.$jstree.jstree(true).select_node(chosen_node_id, true);
                            }
                        }

                        if (self.options.simplified) {
                            self.accept();
                        }
                    });
                }

            /**check node state fucntions*/
            function isNotClickable($element) {
                if ($element.attr('data-not_clickable') == 'true') {
                    return true;
                } else {
                    return false;
                }
            }

            function isDeleted($element) {
                if ($element.attr('data-deleted') == 'true') {
                    return true;
                } else {
                    return false;
                }
            }

            function get_deleted_nodes() {
                return self.$jstree.find('li[data-deleted="true"]');
            }

            function get_not_clickable_nodes() {
                return self.$jstree.find('li[data-not_clickable="true"]');
            }

            function bind_button_events() {
                //Accept
                self.$jstree.on('click', '.action_approve', function(){
                    if (!self.options.disabled) {
                        /*if DISABLED, restrict Accept and Clear*/

                        self.close_tree();

                        self.$jstree.jstree("refresh");
                        self.$buttons.clone().appendTo(self.$jstree);
                        self.$jstree_input.change();

                        self.accept();
                    } else {
                        /*do nothing*/
                    }
                });

                //Clear
                self.$jstree.on('click', '.action_clear', function(){
                    if (!self.options.disabled) {
                        /*if DISABLED, restrict Accept and Clear*/
                        self.close_tree();
                        self.clear();
                        self.$jstree_hidden_input.change();
                    } else {
                        /*do nothing*/
                    }
                });

                //SHow/hide deleted elements
                self.$jstree.on('click', '.action_toggle_deleted', function() {
                    self.$jstree.toggleClass('jstree_hidden_deleted');
                    sessionStorage.setItem(window.location.pathname + '?is_jstree_hidden_deleted',
                        self.$jstree.hasClass('jstree_hidden_deleted'));
                });

                //Cancel
                self.$jstree.on('click', '.action_cancel', function(){
                    self.close_tree();
                    self.cancel();
                });
            }

            function bind_document_events() {
                $(document).on('click', function(e) {

                    /* if tree is not open, do nothing*/
                    if (!self.$jstree.hasClass('active')) return;

                    /* click inside the container -- do nothing*/
                    if ($(e.target).is(self.$jstree_input) ||
                        $(e.target).is(self.$jstree_input_wrapper) ||
                        $(e.target).parents('.jstree').length > 0 && $(e.target).parents('.jstree').is(self.$jstree) ||
                        $(e.target).hasClass('jstree-icon') ||
                        $(e.target).hasClass('action_cancel') ||
                        $(e.target).parent().hasClass('action_cancel') ||
                        $(e.target).hasClass('action_clear') ||
                        $(e.target).parent().hasClass('action_clear')
                       ){
                        return;
                    }

                    /* what if user manually cleared the selection? */
                    set_placeholder();

                    /*if clicked somewhere else*/

                    self.close_tree();
                    self.cancel();
                });

                $(document).keyup(function(e) {
                    if (e.keyCode == 27) {
                        self.cancel();
                        self.close_tree();
                    }
                });

            }

            function bind_autocomplete_search() {
                var timeout = false;
                self.$jstree_input.keyup(function () {
                    if (timeout) { clearTimeout(timeout); }
                    timeout = setTimeout(function () {
                        self.$jstree.jstree("search", self.$jstree_input.val());
                    }, 250);
                });
            }

		/*START and INIT*/
		if (self.options.url.length > 0) {
            self.load_json({ source: self.options.url, selected: self.options.selected});
        } else if (self.options.data.length > 0) {
            self.load_data(self.options.data, self.options.selected);
        }

        self.$jstree.scroll(function(){
            self.place_buttons();
        });

    },

    destroy: function () {
        this.$jstree.remove();
        this.$jstree_input_wrapper.parent().html(this.$jstree_hidden_input);
    }
	
});
